import { Request, Response } from 'express';
import Contact from '../models/contact.model';
import List from '../models/list.model';
import fs from 'fs';
import csv from 'csv-parser';
import * as xlsx from 'xlsx';
import mongoose from 'mongoose';
import { create } from 'domain';

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

// POST Create Contact
export const createContact = async (req: Request, res: Response) => {
  try {
    const { email, name, lists } = req.body;

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

    // 3️⃣ Create Contact
    const newContact = await Contact.create({
      email,
      name,
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


// POST Import Contacts (Bonus: Bulk Create)
export const importContacts = async (req: Request, res: Response) => {
    try {
        const { contacts } = req.body; // Expects array of { email, name, lists? }
        
        if (!Array.isArray(contacts)) {
            return res.status(400).json({ message: 'Invalid data format. Expected array of contacts.' });
        }

        const result = await Contact.insertMany(contacts, { ordered: false }); 
        // ordered: false allows continuing even if some fail (like duplicates)

        res.status(201).json({ 
            message: `Successfully imported ${result.length} contacts`,
            count: result.length 
        });
    } catch (err: any) {
        // If some duplicates failed, we still likely succeeded with others
        res.status(400).json({ message: 'Some contacts could not be imported (likely duplicates)', error: err.message });
    }
};

// PUT Update Contact
export const updateContact = async (req: Request, res: Response) => {
  try {
    const { email, name, lists } = req.body
    const contactId = req.params.id

    // 🔹 existing contact
    const existingContact = await Contact.findById(contactId)
    if (!existingContact) {
      return res.status(404).json({ message: "Contact not found" })
    }

    const prevLists = existingContact.lists.map(String)
    const nextLists = lists?.map(String) || []

    // 🔥 1️⃣ UPDATE CONTACT
    if (email !== undefined) existingContact.email = email
    if (name !== undefined) existingContact.name = name
    if (lists !== undefined) existingContact.lists = nextLists

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
      const contacts: { email: string; name?: string }[] = [];
  
      // Helper to find common header names
      const getEmailAndName = (row: any) => {
        let email = "";
        let name = "";
  
        const emailKeys = ["email", "gmail", "mail", "e-mail", "email address", "emails", "id", "user email"];
        const nameKeys = ["name", "full name", "first name", "contact name", "names", "user", "username"];
  
        console.log("🔍 Processing row keys:", Object.keys(row));

        for (const key of Object.keys(row)) {
          const lowerKey = key.toLowerCase().trim();
          const value = row[key]?.toString().trim();
          if (!value) continue;

          console.log(`   - Key: "${key}" (normalized: "${lowerKey}"), Value: "${value}"`);

          if (!email && emailKeys.some(k => lowerKey.includes(k))) {
            // Basic email validation
            if (value.includes('@')) {
              email = value;
              console.log(`     ✅ Found email: ${email}`);
            }
          }
          if (!name && nameKeys.some(k => lowerKey.includes(k))) {
            name = value;
            console.log(`     ✅ Found name: ${name}`);
          }
        }
        return { email, name };
      };
  
      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

      if (file.mimetype === "text/csv" || fileExtension === 'csv') {
        console.log("📄 Detected CSV format");
        const stream = fs.createReadStream(filePath).pipe(csv());
        
        for await (const data of stream) {
          const { email, name } = getEmailAndName(data);
          if (email) {
            contacts.push({ email, name });
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
          const { email, name } = getEmailAndName(row);
          if (email) {
            contacts.push({ email, name });
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
        const updateData: any = { $set: { name: c.name } };
        
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
