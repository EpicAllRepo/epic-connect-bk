import { Request, Response } from 'express';
import List from '../models/list.model';
import Contact from '../models/contact.model';
import mongoose from 'mongoose';

// GET All Lists
export const getLists = async (req: Request, res: Response) => {
    try {
        console.log("🔍 Fetching all lists and their contact counts...");
        const lists = await List.find().sort({ createdAt: -1 });
        
        // Use Promise.all to fetch counts for each list in parallel
        const listsWithCounts = await Promise.all(lists.map(async (list) => {
            const contactCount = await Contact.countDocuments({ 
                lists: list._id 
            });
            
            console.log(`   - List "${list.name}" (${list._id}) has ${contactCount} contacts.`);
            
            return {
                ...list.toObject(),
                contactCount
            };
        }));

        res.json(listsWithCounts);
    } catch (err: any) {
        console.error("❌ Error in getLists:", err);
        res.status(500).json({ message: err.message });
    }
};

// GET Single List by ID
export const getListById = async (req: Request, res: Response) => {
    try {
        const list = await List.findById(req.params.id);
        if (!list) return res.status(404).json({ message: 'List not found' });
        
        // Fetch contacts that have this list explicitly assigned
        const contacts = await Contact.find({ lists: list._id });
        const contactCount = await Contact.countDocuments({ lists: list._id });
        
        res.json({
            ...list.toObject(),
            contactCount,
            contacts // Return the actual contacts from the Contact collection
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST Create List
export const createList = async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;
        const newList = await List.create({ name, description });
        res.status(201).json(newList);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};

// PUT Update List
export const updateList = async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;
        const list = await List.findByIdAndUpdate(
            req.params.id,
            { name, description },
            { new: true }
        );
        if (!list) return res.status(404).json({ message: 'List not found' });
        res.json(list);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};

// DELETE List
export const deleteList = async (req: Request, res: Response) => {
    try {
        const list = await List.findByIdAndDelete(req.params.id);
        if (!list) return res.status(404).json({ message: 'List not found' });
        res.json({ message: 'List deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};


export const assignContactToList = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    let { listId, contactId, contactIds, listIds } = req.body;

    // 1. Normalize List IDs (Always make it an array)
    const rawListIds = Array.isArray(listIds) ? listIds : (listIds ? [listIds] : (listId ? [listId] : []));
    const finalListIds = rawListIds.filter((id: any) => mongoose.Types.ObjectId.isValid(id));

    // 2. Normalize Contact IDs (Always make it an array)
    const rawContactIds = Array.isArray(contactIds) ? contactIds : (contactIds ? [contactIds] : (contactId ? [contactId] : []));
    const finalContactIds = rawContactIds.filter((id: any) => mongoose.Types.ObjectId.isValid(id));

    if (finalListIds.length === 0 || finalContactIds.length === 0) {
      res.status(400).json({ 
        message: "Valid listId and contactId(s) are required (MongoDB ID format)." 
      });
      return;
    }

    // 3. Update the Lists to include these Contacts
    await List.updateMany(
      { _id: { $in: finalListIds } },
      { $addToSet: { contacts: { $each: finalContactIds } } }
    );

    // 4. Update the Contacts to include these Lists
    await Contact.updateMany(
      { _id: { $in: finalContactIds } },
      { $addToSet: { lists: { $each: finalListIds } } }
    );

    res.json({ 
      message: "Assignment successful ✅",
      assignedContacts: finalContactIds.length,
      assignedToLists: finalListIds.length
    });
  } catch (error: any) {``
    res.status(500).json({ message: "Assignment failed", error: error.message });
  }
};