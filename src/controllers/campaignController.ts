import { Request, Response } from 'express';
import Campaign from '../models/Campaign';
import Contact, { IContact } from '../models/Contact';
import EmailJob, { IEmailJob } from '../models/EmailJob';

export const getCampaigns = async (req: Request, res: Response) => {
    try {
        const campaigns = await Campaign.find().sort({ createdAt: -1 });
        res.json(campaigns);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const createCampaign = async (req: Request, res: Response) => {
    try {
        const { name, subject, body, listIds, contactIds, intervalMinutes } = req.body;

        // 1. Create the Campaign
        const campaign = await Campaign.create({
            name,
            subject,
            body,
            lists: listIds || [],
            scheduleType: intervalMinutes && intervalMinutes > 0 ? 'interval' : 'immediate',
            intervalMinutes: intervalMinutes || 0,
            status: 'scheduled'
        });

        // 2. Fetch Contacts from Lists and Individual Selections
        const query: any = {};
        const conditions = [];

        if (listIds && listIds.length > 0) {
            conditions.push({ lists: { $in: listIds } });
        }
        if (contactIds && contactIds.length > 0) {
            conditions.push({ _id: { $in: contactIds } });
        }

        if (conditions.length === 0) {
            res.status(400).json({ message: "No lists or contacts selected" });
            return;
        }

        const contacts = await Contact.find({ $or: conditions });
        
        // Deduplicate by ID and Email
        const uniqueContactsMap = new Map();
        contacts.forEach(c => uniqueContactsMap.set(c.email, c));
        const uniqueContacts = Array.from(uniqueContactsMap.values());

        if (uniqueContacts.length === 0) {
            res.status(400).json({ message: "No valid contacts found for the selection" });
            return;
        }

        // 3. Create Email Jobs (Throttling Logic)
        const jobs: Partial<IEmailJob>[] = [];
        const startTime = new Date(); 

        uniqueContacts.forEach((contact, index) => {
            // Logic: email 1 -> +5 min, email 2 -> +10 min, email 3 -> +15 min...
            const delayMs = (index + 1) * ((intervalMinutes || 0) * 60 * 1000);
            const scheduledAt = new Date(startTime.getTime() + delayMs);

            jobs.push({
                campaignId: campaign._id as any,
                contactId: contact._id as any,
                email: contact.email,
                scheduledAt: scheduledAt,
                status: 'pending'
            });
        });

        await EmailJob.insertMany(jobs);

        res.status(201).json({ 
            success: true, 
            message: `Campaign scheduled for ${uniqueContacts.length} contacts. Emails will be sent every ${intervalMinutes || 0} minutes.`,
            campaignId: campaign._id,
            totalRecipients: uniqueContacts.length
        });

    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

export const deleteCampaign = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        // 1. Delete associated email jobs
        await EmailJob.deleteMany({ campaignId: id });
        
        // 2. Delete the campaign
        const campaign = await Campaign.findByIdAndDelete(id);
        
        if (!campaign) {
            return res.status(404).json({ message: "Campaign not found" });
        }
        
        res.json({ message: "Campaign and its email jobs deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

