import { Request, Response } from 'express';
import Campaign from '../models/campaign.model';
import Contact from '../models/contact.model';
import List from '../models/list.model';
import EmailJob from '../models/emailjob.model';
import mongoose from 'mongoose';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
         const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };
        // 1. Basic Stats (Counts)
        const [
            totalContacts,
            totalLists,
            totalCampaigns,
            sentEmails,
            scheduledEmails,
            failedEmails
        ] = await Promise.all([
            Contact.countDocuments({ createdBy: userId }),
            List.countDocuments({ createdBy: userId }),
            Campaign.countDocuments({ createdBy: userId }),
            EmailJob.countDocuments({ status: 'sent', createdBy: userId }),
            EmailJob.countDocuments({ status: 'pending', createdBy: userId }),
            EmailJob.countDocuments({ status: 'failed', createdBy: userId })
        ]);

        // 2. Fetch Recent Data (Connecting other GET APIs logic)

        // Fetch All Lists with Contact Counts (as done in listController)
        // const lists = await List.find().sort({ createdAt: -1 });
        // const listsWithCounts = await Promise.all(lists.map(async (list) => {
        //     const contactCount = await Contact.countDocuments({ lists: list._id });
        //     return {
        //         ...list.toObject(),
        //         contactCount
        //     };
        // }));

        // Fetch Recent 5 Campaigns
        const recentCampaign = await Campaign
            .findOne({ createdBy: new mongoose.Types.ObjectId(userId) })
            .sort({ createdAt: -1 });

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
            // recentContacts: recentContacts,
            recentCampaigns: recentCampaign,
            // lists: listsWithCounts
        });
    } catch (err: any) {
        console.error("❌ Error in getDashboardStats:", err);
        res.status(500).json({ message: err.message });
    }
};
