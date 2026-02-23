import { Request, Response } from 'express';
import Contact from '../models/contact.model';
import List from '../models/list.model';
import fs from 'fs';
import csv from 'csv-parser';
import * as xlsx from 'xlsx';
import mongoose from 'mongoose';

// GET All Contacts
export const getContacts = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const skip = (page - 1) * limit;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };

    const total = await Contact.countDocuments({
      createdBy: userId
    });

    const contacts = await Contact.find({
      createdBy: userId
    })
      .select("firstName lastName email phone lists createdAt updatedAt")
      .populate("lists", "name")
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      data: contacts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalContacts: total,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};



// GET Single Contact
export const getContactById = async (req: Request, res: Response) => {
   const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      createdBy: userId
    }).populate('lists');
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    res.json(contact);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// Helper: build firstName/lastName from name or use provided first/last
const toFirstLastName = (body: { name?: string; firstName?: string; lastName?: string }) => {
  let firstName = (body.firstName ?? '').trim();
  let lastName = (body.lastName ?? '').trim();
  const name = (body.name ?? '').trim();
  if (name && !firstName && !lastName) {
    const parts = name.split(/\s+/);
    firstName = parts[0] ?? '';
    lastName = parts.slice(1).join(' ') ?? '';
  }
  return { firstName, lastName, name: [firstName, lastName].filter(Boolean).join(' ') || undefined };
};

// POST Create Contact
export const createContact = async (req: Request, res: Response) => {
  try {
    const { email, name, firstName, lastName, lists } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
     const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };
    // 1️⃣ Check duplicate
    const exists = await Contact.findOne({
      email,
      createdBy: userId
    });
    if (exists) {
      return res
        .status(400)
        .json({ message: "Contact with this email already exists" });
    }

    // 2️⃣ Normalize + validate listIds
    const listIds = Array.isArray(lists)
      ? lists.filter(id => mongoose.Types.ObjectId.isValid(id))
      : [];

    const { firstName: fn, lastName: ln, name: fullName } = toFirstLastName({ name, firstName, lastName });

    // 3️⃣ Create Contact (firstName, lastName everywhere)
    const newContact = await Contact.create({
      email,
      firstName: fn,
      lastName: ln,
      name: fullName,
      lists: listIds,
      createdBy: userId
    });

    // 4️⃣ 🔥 IMPORTANT: Update Lists collection
    if (listIds.length > 0) {
      await List.updateMany(
        { _id: { $in: listIds }, createdBy: userId },
        { $addToSet: { contacts: newContact._id } }
      );
    }

    res.status(201).json({
      message: "Contact created & assigned to lists ✅",
      contact: newContact
    });

  } catch (err: any) {
    console.error("❌ createContact error:", err);
    res.status(500).json({ message: err.message });
  }
};


// POST Import Contacts (Bulk Create) - array of { email, firstName?, lastName?, name?, lists? }
export const importContacts = async (req: Request, res: Response) => {
  try {
    const { contacts } = req.body;

    if (!Array.isArray(contacts)) {
      return res.status(400).json({ message: 'Invalid data format. Expected array of contacts.' });
    }

    const normalized = contacts.map((c: any) => {
       const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };
      const { firstName, lastName, name } = toFirstLastName({
        name: c.name,
        firstName: c.firstName,
        lastName: c.lastName
      });
      return {
        email: c.email,
        firstName,
        lastName,
        name: name || undefined,
        lists: Array.isArray(c.lists)
          ? (c.lists as string[]).filter((id: string) =>
            mongoose.Types.ObjectId.isValid(id)
          )
          : [],
        createdBy: userId
      };
    });

    const result = await Contact.insertMany(normalized, { ordered: false });

    res.status(201).json({
      message: `Successfully imported ${result.length} contacts`,
      count: result.length
    });
  } catch (err: any) {
    res.status(400).json({ message: 'Some contacts could not be imported (likely duplicates)', error: err.message });
  }
};

// PUT Update Contact
export const updateContact = async (req: Request, res: Response) => {
  try {
    const { email, name, firstName, lastName, lists } = req.body
    const contactId = req.params.id
     const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };

    // 🔹 existing contact
    const existingContact = await Contact.findOne({
      _id: contactId,
      createdBy: userId
    });
    if (!existingContact) {
      return res.status(404).json({ message: "Contact not found" })
    }

    const prevLists = existingContact.lists.map(String)
    const nextLists = lists?.map(String) || []

    // 🔥 1️⃣ UPDATE CONTACT (firstName, lastName)
    if (email !== undefined) existingContact.email = email
    if (firstName !== undefined) existingContact.firstName = firstName
    if (lastName !== undefined) existingContact.lastName = lastName
    if (name !== undefined) existingContact.name = name
    if (lists !== undefined) existingContact.lists = nextLists
    // If firstName/lastName provided, keep name in sync
    if (firstName !== undefined || lastName !== undefined) {
      const fn = firstName !== undefined ? firstName : existingContact.firstName
      const ln = lastName !== undefined ? lastName : existingContact.lastName
      existingContact.name = [fn, ln].filter(Boolean).join(' ') || undefined
    }

    await existingContact.save()

    // 🔥 2️⃣ REMOVE contact from OLD lists
    const removedLists = prevLists.filter((id: string) => !nextLists.includes(id))

    if (removedLists.length) {
      await List.updateMany(
        { _id: { $in: removedLists }, createdBy: userId },
        { $pull: { contacts: contactId } }
      )
    }

    // 🔥 3️⃣ ADD contact to NEW lists
    const addedLists = nextLists.filter((id: string) => !prevLists.includes(id))

    if (addedLists.length) {
      await List.updateMany(
        { _id: { $in: addedLists }, createdBy: userId },
        { $addToSet: { contacts: contactId } } // duplicate safe
      )
    }

    res.json(existingContact)
  } catch (err: any) {
    res.status(400).json({ message: err.message })
  }
}


// DELETE Contact
export const deleteContacts = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body || {};
    const { id } = req.query;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let contactIds: string[] = [];

    // 🔴 SINGLE DELETE
    if (id && typeof id === "string") {
      contactIds = [id];
    }

    // 🔵 BULK DELETE
    if (ids && Array.isArray(ids) && ids.length > 0) {
      contactIds = ids;
    }

    if (contactIds.length === 0) {
      return res.status(400).json({ message: "No id or ids provided" });
    }

    // 1️⃣ Find contacts before deleting (to know their lists)
    const contacts = await Contact.find({
      _id: { $in: contactIds },
      createdBy: userId,
    });

    if (!contacts.length) {
      return res.status(404).json({ message: "Contact(s) not found" });
    }

    // 2️⃣ Collect list IDs
    const listIds = contacts.flatMap((c) => c.lists.map(String));

    // 3️⃣ Delete contacts
    await Contact.deleteMany({
      _id: { $in: contactIds },
      createdBy: userId,
    });

    // 4️⃣ Remove contacts from Lists
    if (listIds.length > 0) {
      await List.updateMany(
        {
          _id: { $in: listIds },
          createdBy: userId,
        },
        {
          $pull: { contacts: { $in: contactIds } },
        }
      );
    }

    res.json({
      message: `${contactIds.length} contact(s) deleted successfully ✅`,
    });
  } catch (err: any) {
    console.error("Delete error:", err);
    res.status(500).json({ message: err.message });
  }
};





// 📤 Bulk Upload Contacts (CSV / Excel)
export const uploadContacts = async (
  req: any,
  res: Response
): Promise<void> => {
  const file = req.file;
  const { listId } = req.body;

  if (!file) {
    console.error("❌ No file received in uploadContacts");
    res.status(400).json({ message: "No file selected. Please select a CSV or Excel file." });
    return;
  }

  const filePath = file.path;
  console.log(`📂 Processing file: ${file.originalname}, mimetype: ${file.mimetype}, path: ${filePath}`);

  try {
    const contacts: { email: string; firstName?: string; lastName?: string }[] = [];

    // Helper: detect email, firstName, lastName from CSV/Excel columns
    const getEmailAndNames = (row: any) => {
      let email = "";
      let firstName = "";
      let lastName = "";

      const emailKeys = ["email", "gmail", "mail", "e-mail", "email address", "emails", "id", "user email"];
      const firstNameKeys = ["first name", "firstname", "first", "fname", "given name"];
      const lastNameKeys = ["last name", "lastname", "last", "lname", "surname", "family name"];
      const fullNameKeys = ["name", "full name", "contact name", "names", "user", "username"];

      for (const key of Object.keys(row)) {
        const lowerKey = key.toLowerCase().trim();
        const value = row[key]?.toString().trim();
        if (!value) continue;

        if (!email && emailKeys.some(k => lowerKey.includes(k)) && value.includes('@')) {
          email = value;
        }
        if (!firstName && firstNameKeys.some(k => lowerKey.includes(k))) {
          firstName = value;
        }
        if (!lastName && lastNameKeys.some(k => lowerKey.includes(k))) {
          lastName = value;
        }
        // If only "name" / "full name" column: split into first + last
        if ((!firstName || !lastName) && fullNameKeys.some(k => lowerKey.includes(k))) {
          const parts = value.split(/\s+/).filter(Boolean);
          if (parts.length >= 1 && !firstName) firstName = parts[0];
          if (parts.length >= 2 && !lastName) lastName = parts.slice(1).join(' ');
        }
      }
      return { email, firstName, lastName };
    };

    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    if (file.mimetype === "text/csv" || fileExtension === 'csv') {
      console.log("📄 Detected CSV format");
      const stream = fs.createReadStream(filePath).pipe(csv());

      for await (const data of stream) {
        const { email, firstName, lastName } = getEmailAndNames(data);
        if (email) {
          contacts.push({ email, firstName, lastName });
        }
      }
      console.log(`✅ CSV processed. Found ${contacts.length} valid contacts.`);
      await saveToDatabase(contacts, res, filePath, listId);
    } else if (
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype === "application/octet-stream" ||
      ['xlsx', 'xls'].includes(fileExtension || '')
    ) {
      console.log("📊 Detected Excel format");
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

      console.log(`📝 Excel rows found: ${sheetData.length}`);

      sheetData.forEach((row) => {
        const { email, firstName, lastName } = getEmailAndNames(row);
        if (email) {
          contacts.push({ email, firstName, lastName });
        }
      });

      console.log(`✅ Excel processed. Found ${contacts.length} valid contacts.`);
      await saveToDatabase(contacts, res, filePath, listId);
    } else {
      console.error(`❌ Unsupported mimetype: ${file.mimetype}`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.status(400).json({ message: `Format not supported (${file.mimetype}). Please use CSV or Excel (.xlsx).` });
    }
  } catch (error: any) {
    console.error("❌ Upload worker error:", error);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ message: "File processing failed", error: error.message });
  }
};

// Helper function to save contacts
const saveToDatabase = async (
  contacts: { email: string; firstName?: string; lastName?: string }[],
  res: Response,
  filePath: string,
  listIds: string[] | string
) => {
  try {
    const userId = (res.req as any).user.userId;
    const finalListIds = Array.isArray(listIds)
      ? listIds
      : listIds
        ? [listIds]
        : [];

    let addedCount = 0;
    let duplicateCount = 0;
    const duplicateEmails: string[] = [];
    const newContactIds: string[] = [];

    for (const contact of contacts) {
      const existing = await Contact.findOne({ email: contact.email, createdBy: userId });

      if (existing) {
        duplicateCount++;
        duplicateEmails.push(contact.email);
        continue;
      }

      const newContact = await Contact.create({
        ...contact,
        lists: finalListIds,
        createdBy: userId
      });

      newContactIds.push(newContact._id.toString());
      addedCount++;
    }

    // 🔹 Update Lists (ADD contacts to lists)
    if (newContactIds.length > 0 && finalListIds.length > 0) {
      await List.updateMany(
        {
          _id: { $in: finalListIds },
          createdBy: userId
        },
        { $addToSet: { contacts: { $each: newContactIds } } }
      );
    }

    // Optional: update count field if you have it
    if (finalListIds.length > 0) {
      for (const listId of finalListIds) {
        const count = await Contact.countDocuments({
          lists: listId,
          createdBy: userId
        });

        await List.findOneAndUpdate(
          { _id: listId, createdBy: userId },
          { contactCount: count }
        );
      }
    }

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({
      message: "Upload completed ✅",
      addedCount,
      duplicateCount,
      duplicateEmails,
    });
  } catch (error: any) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({
      message: "Database save failed",
      error: error.message,
    });
  }
};



// get contact header fields
// GET Contact Fields (Dynamic Keys)
export const getContactFields = async (req: Request, res: Response) => {
  try {
     const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };
    // 🔹 Only 1 document needed
    const contact = await Contact.findOne({
      createdBy: userId
    }).lean();

    if (!contact) {
      return res.json({ fields: [] })
    }

    // ❌ Keys to exclude
    const excludedKeys = ["_id", "__v", "lastName", "createdAt", "lists", "name", "updatedAt", "createdBy"] // firstName/lastName/name are derived from each other, so we can exclude them to avoid confusion

    // 🔹 Extract allowed keys
    const fields = Object.keys(contact).filter(
      key => !excludedKeys.includes(key)
    )

    res.json({
      fields
    })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
}
