import { Request, Response } from 'express';
import Campaign from '../models/Campaign';
import Contact from '../models/Contact';
import List from '../models/List';
import EmailJob from '../models/EmailJob';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        // 1. Basic Stats (Counts)
        const [
            totalContacts, 
            totalLists, 
            totalCampaigns, 
            sentEmails, 
            scheduledEmails, 
            failedEmails
        ] = await Promise.all([
            Contact.countDocuments(),
            List.countDocuments(),
            Campaign.countDocuments(),
            EmailJob.countDocuments({ status: 'sent' }),
            EmailJob.countDocuments({ status: 'pending' }),
            EmailJob.countDocuments({ status: 'failed' })
        ]);

        // 2. Fetch Recent Data (Connecting other GET APIs logic)
        
        // Fetch All Lists with Contact Counts (as done in listController)
        const lists = await List.find().sort({ createdAt: -1 });
        const listsWithCounts = await Promise.all(lists.map(async (list) => {
            const contactCount = await Contact.countDocuments({ lists: list._id });
            return {
                ...list.toObject(),
                contactCount
            };
        }));

        // Fetch Recent 5 Campaigns
        const recentCampaigns = await Campaign.find().sort({ createdAt: -1 }).limit(5);

        // Fetch Recent 5 Contacts
        const recentContacts = await Contact.find().populate('lists').sort({ createdAt: -1 }).limit(5);

        // 3. Consolidate and Send Response
        res.json({
            stats: {
                totalContacts,
                totalLists,
                totalCampaigns,
                sentEmails,
                scheduledEmails,
                failedEmails,
                deliveredEmails: sentEmails // Basic mapping
            },
            recentContacts: recentContacts,
            recentCampaigns: recentCampaigns,
            lists: listsWithCounts
        });
    } catch (err: any) {
        console.error("❌ Error in getDashboardStats:", err);
        res.status(500).json({ message: err.message });
    }
};
