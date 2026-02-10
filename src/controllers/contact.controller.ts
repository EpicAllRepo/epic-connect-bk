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
        const contacts = await Contact.find().populate('lists').sort({ createdAt: -1 });
        res.json(contacts);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// GET Single Contact
export const getContactById = async (req: Request, res: Response) => {
    try {
        const contact = await Contact.findById(req.params.id).populate('lists');
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

    // 1️⃣ Check duplicate
    const exists = await Contact.findOne({ email });
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
      lists: listIds
    });

    // 4️⃣ 🔥 IMPORTANT: Update Lists collection
    if (listIds.length > 0) {
      await List.updateMany(
        { _id: { $in: listIds } },
        {
          $addToSet: {
            contacts: newContact._id
          }
        }
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
                lists: Array.isArray(c.lists) ? c.lists : []
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

    // 🔹 existing contact
    const existingContact = await Contact.findById(contactId)
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
        { _id: { $in: removedLists } },
        { $pull: { contacts: contactId } }
      )
    }

    // 🔥 3️⃣ ADD contact to NEW lists
   const addedLists = nextLists.filter((id: string) => !prevLists.includes(id))

    if (addedLists.length) {
      await List.updateMany(
        { _id: { $in: addedLists } },
        { $addToSet: { contacts: contactId } } // duplicate safe
      )
    }

    res.json(existingContact)
  } catch (err: any) {
    res.status(400).json({ message: err.message })
  }
}


// DELETE Contact
export const deleteContact = async (req: Request, res: Response) => {
    try {
        const contact = await Contact.findByIdAndDelete(req.params.id);
        if (!contact) return res.status(404).json({ message: 'Contact not found' });
        res.json({ message: 'Contact deleted successfully' });
    } catch (err: any) {
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
  const saveToDatabase = async (contacts: any[], res: Response, filePath: string, listId?: string) => {
    try {
      console.log(`💾 Saving ${contacts.length} contacts to database...`);
      
      if (contacts.length === 0) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ message: "No contacts found in file. Make sure you have an 'Email' column." });
      }

      const operations: any[] = contacts.map((c) => {
        const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || undefined;
        const updateData: any = {
          $set: {
            firstName: c.firstName ?? '',
            lastName: c.lastName ?? '',
            name: fullName
          }
        };
        if (listId && mongoose.Types.ObjectId.isValid(listId)) {
          updateData.$addToSet = { lists: new mongoose.Types.ObjectId(listId) };
        }

        return {
          updateOne: {
            filter: { email: c.email },
            update: updateData,
            upsert: true,
          },
        };
      });
  
      await Contact.bulkWrite(operations);
      console.log("💪 Bulk write completed successfully");
  
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
  
      res.json({
        message: `Successfully uploaded ${contacts.length} contacts! ✅`,
        count: contacts.length
      });
    } catch (error: any) {
      console.error("❌ Database save error:", error);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.status(500).json({ message: "Failed to save contacts to database", error: error.message });
    }
  };
