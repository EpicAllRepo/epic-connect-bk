import { Request, Response } from 'express';
import List from '../models/list.model';
import Contact from '../models/contact.model';

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
