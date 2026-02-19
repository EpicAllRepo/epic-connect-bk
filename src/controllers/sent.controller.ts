import { Request, Response } from 'express';
import EmailJob from '../models/emailjob.model';

// GET All Sent Emails (History)
export const getSentEmails = async (req: Request, res: Response) => {
     const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };
    const userRole = req.user?.role;

    try {
        const { campaignId, page = 1, limit = 50 } = req.query;
        const query: any = { status: 'sent' };
        if (userRole !== 'superadmin') {
            query.createdBy = userId;
        }

        if (campaignId) {
            query.campaignId = campaignId;
        }

        const jobs = await EmailJob.find(query)
            .populate('campaignId', 'name subject')
            .populate('contactId', 'name firstName lastName email')
            .sort({ sentAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));

        const total = await EmailJob.countDocuments(query);

        res.json({
            total,
            page: Number(page),
            limit: Number(limit),
            results: jobs
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE Sent History Item
export const deleteSentHistory = async (req: Request, res: Response) => {
     const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };
    const userRole = req.user?.role;
    let job;
    try {
        if (userRole === 'superadmin') {
            job = await EmailJob.findByIdAndDelete(req.params.id);
        } else {
            job = await EmailJob.findOneAndDelete({
                _id: req.params.id,
                createdBy: userId
            });
        }
        if (!job) return res.status(404).json({ message: 'History record not found' });
        res.json({ message: 'Sent history record deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
