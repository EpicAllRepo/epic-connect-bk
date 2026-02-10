import nodemailer from 'nodemailer';
import EmailJob, { IEmailJob } from '../models/emailjob.model';
import SMTP, { ISMTP } from '../models/smtp.model';
import Campaign, { ICampaign } from '../models/campaign.model';
import { personalizeMessage } from './personalization';

const processQueue = async (): Promise<void> => {
    try {
        // 1. Find jobs that are ready to be sent
        const jobs = await EmailJob.find({
            status: 'pending',
            scheduledAt: { $lte: new Date() }
        })
        .populate('campaignId')
        .populate('contactId') // Need contact details for personalization
        .limit(50);

        if (jobs.length === 0) return;

        console.log(`[EmailProcessor] Found ${jobs.length} emails due for sending.`);

        // 2. Get SMTP Configuration
        const smtpConfig = await SMTP.findOne({ isDefault: true });
        if (!smtpConfig) {
            console.error("[EmailProcessor] No SMTP Config found. Please configure SMTP.");
            return;
        }

        // 3. Create Transporter
        console.log(`[PROCESSOR DEBUG] Using Host: ${smtpConfig.host}, User: ${smtpConfig.user}`);
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.port === 465,
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass
            }
        });

        // 4. Send Emails
        for (const job of jobs) {
            try {
                // Type assertion for populated campaignId
                // In a real app we might want more robust type checking here
                const campaign = job.campaignId as unknown as ICampaign;
                const contact = job.contactId as any; // Populated contact

                // --- Personalization Logic (Replace {{name}} etc) ---
                let personalizedBody: string;
                let personalizedSubject: string;

                if (contact) {
                    personalizedBody = personalizeMessage(campaign.body, contact as any);
                    personalizedSubject = personalizeMessage(campaign.subject, contact as any);
                } else {
                    personalizedBody = campaign.body;
                    personalizedSubject = campaign.subject;
                }
                // ----------------------------------------------------
                
                await transporter.sendMail({
                    from: `"${smtpConfig.fromName || 'Epic Connect'}" <${smtpConfig.fromEmail}>`,
                    to: job.email,
                    subject: personalizedSubject,
                    text: personalizedBody, // Fallback
                    html: personalizedBody  // Use HTML for rich text
                });

                job.status = 'sent';
                job.sentAt = new Date();
                await job.save();

                await Campaign.findByIdAndUpdate(campaign._id, {
                    $inc: { 'stats.sent': 1 }
                });

                console.log(`[EmailProcessor] Sent to ${job.email}`);

            } catch (err: any) {
                console.error(`[EmailProcessor] Failed to send to ${job.email}:`, err.message);
                
                job.status = 'failed';
                job.error = err.message;
                await job.save();

                const campaign = job.campaignId as unknown as ICampaign;
                await Campaign.findByIdAndUpdate(campaign._id, {
                    $inc: { 'stats.bounced': 1 }
                });
            }
        }

    } catch (error) {
        console.error("[EmailProcessor] Critical Error:", error);
    }
};

const startProcessor = (): void => {
    console.log("Starting Email Background Processor...");
    setInterval(processQueue, 20 * 1000);
};

export default startProcessor;
