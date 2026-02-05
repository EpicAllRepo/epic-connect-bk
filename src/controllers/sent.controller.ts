import { Request, Response } from 'express';
import EmailJob from '../models/emailjob.model';

// GET All Sent Emails (History)
export const getSentEmails = async (req: Request, res: Response) => {
    try {
        const { campaignId, page = 1, limit = 50 } = req.query;
        const query: any = { status: 'sent' };

        if (campaignId) {
            query.campaignId = campaignId;
        }

        const jobs = await EmailJob.find(query)
            .populate('campaignId', 'name subject')
            .populate('contactId', 'name')
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
    try {
        const job = await EmailJob.findByIdAndDelete(req.params.id);
        if (!job) return res.status(404).json({ message: 'History record not found' });
        res.json({ message: 'Sent history record deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
