import nodemailer from "nodemailer";
import mongoose from "mongoose";
import EmailJob from "../models/emailjob.model";
import SMTP from "../models/smtp.model";
import Campaign from "../models/campaign.model";
import { personalizeMessage } from "./personalization";
import { io } from "../server";

// ✅ NEW: Tracking inject function
const URL = "https://epicconnectapi.epicglobal.co.in";
  // process.env.NODE_ENV === "production"
  //   ? process.env.BASE_URL!
  //   : "http://localhost:5001";

function injectTracking(htmlBody: string, jobId: string): string {
  const trackingPixel = `<img src="${URL}/api/campaigns/track/open/${jobId}" width="1" height="1" style="display:none;width:1px;height:1px;" />`;

  let html = htmlBody;
  if (!htmlBody.trim().startsWith('<')) {
    html = `<div>${htmlBody.replace(/\n/g, '<br/>')}</div>`;
  }

  // ✅ Skip domains
  const skipDomains = ['wa.me', 'whatsapp.com', 'tel:', 'mailto:'];

  const trackedBody = html.replace(
    /href=["'](https?:\/\/[^"']+)["']/gi,
    (match, url) => {
      // ✅ Yeh sirf add kiya hai
      if (skipDomains.some(domain => url.includes(domain))) {
        return match;
      }
      const encodedUrl = encodeURIComponent(url);
      return `href="${URL}/api/campaigns/track/click/${jobId}?url=${encodedUrl}"`;
    }
  );

  return trackedBody + trackingPixel;
}

const processQueue = async (): Promise<void> => {
  try {
    const now = new Date();

    const usersWithPendingJobs = await EmailJob.distinct("createdBy", {
      status: "pending",
      scheduledAt: { $lte: now }
    });

    if (!usersWithPendingJobs.length) return;

    console.log(`[EmailProcessor] Found ${usersWithPendingJobs.length} users with pending jobs`);

    for (const rawUserId of usersWithPendingJobs) {
      const userId = new mongoose.Types.ObjectId(rawUserId);

      const jobs = await EmailJob.find({
        status: "pending",
        scheduledAt: { $lte: now },
        createdBy: userId
      })
        .populate("campaignId")
        .populate("contactId")
        .limit(50);

      if (!jobs.length) continue;

      console.log(`[EmailProcessor] Processing ${jobs.length} emails for user ${userId}`);

      const smtpConfig = await SMTP.findOne({ createdBy: userId, isDefault: true });

      if (!smtpConfig) {
        console.error(`[EmailProcessor] No SMTP configured for user ${userId}`);
        continue;
      }

      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.port === 465,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass
        }
      });

      const processedCampaignIds = new Set<string>();

      for (const job of jobs) {
        try {
          const campaign: any = job.campaignId;
          const contact: any = job.contactId;

          if (!campaign) {
            job.status = "failed";
            job.error = "Campaign not found";
            await job.save();
            continue;
          }

          let personalizedBody = campaign.body;
          let personalizedSubject = campaign.subject;

          if (contact) {
            personalizedBody = personalizeMessage(campaign.body, contact);
            personalizedSubject = personalizeMessage(campaign.subject, contact);
          }

          // ✅ NEW: Inject tracking into HTML body
          const trackedHtmlBody = injectTracking(personalizedBody, String(job._id));

          await transporter.sendMail({
            from: `"${smtpConfig.fromName || "Epic Connect"}" <${smtpConfig.fromEmail}>`,
            to: job.email,
            subject: personalizedSubject,
            text: personalizedBody,       // plain text unchanged
            html: trackedHtmlBody         // ✅ tracked HTML
          });

          job.status = "sent";
          job.sentAt = new Date();
          // ✅ NEW: Mark delivered immediately after successful send
          job.isDelivered = true;
          await job.save();

          await Campaign.updateOne(
            { _id: campaign._id, createdBy: userId },
            {
              $inc: {
                "stats.sent": 1,
                "stats.delivered": 1   // ✅ NEW: Increment delivered too
              }
            }
          );
          io.to(String(userId)).emit("campaignStatsUpdated", {
            campaignId: String(campaign._id),
            type: "sent"
          });

          processedCampaignIds.add(String(campaign._id));
          console.log(`[EmailProcessor] ✅ Sent to ${job.email}`);

        } catch (err: any) {
          console.error(`[EmailProcessor] ❌ Failed for ${job.email}:`, err.message);

          job.status = "failed";
          job.error = err.message;
          await job.save();

          const campaign: any = job.campaignId;
          if (campaign) {
            await Campaign.updateOne(
              { _id: campaign._id, createdBy: userId },
              { $inc: { "stats.failed": 1 } }
            );
            io.to(String(userId)).emit("campaignStatsUpdated", {
              campaignId: String(campaign._id),
              type: "failed"
            });
            processedCampaignIds.add(String(campaign._id));
          }
        }
      }

      // Campaign status update logic (unchanged)
      for (const campaignId of processedCampaignIds) {
        const campaign = await Campaign.findOne({ _id: campaignId, createdBy: userId });
        if (!campaign) continue;

        const [totalJobs, sentJobs, failedJobs, pendingJobs] = await Promise.all([
          EmailJob.countDocuments({ campaignId, createdBy: userId }),
          EmailJob.countDocuments({ campaignId, createdBy: userId, status: "sent" }),
          EmailJob.countDocuments({ campaignId, createdBy: userId, status: "failed" }),
          EmailJob.countDocuments({ campaignId, createdBy: userId, status: "pending" })
        ]);

        let newStatus = campaign.status;

        if (pendingJobs > 0) {
          newStatus = "processing";
        } else if (sentJobs === totalJobs && totalJobs > 0) {
          newStatus = "sent";
        } else if (failedJobs === totalJobs && totalJobs > 0) {
          newStatus = "draft";
        } else if (sentJobs > 0 && sentJobs + failedJobs === totalJobs) {
          newStatus = "sent";
        }

        if (newStatus !== campaign.status) {
          await Campaign.updateOne(
            { _id: campaignId, createdBy: userId },
            { status: newStatus }
          );
          io.to(String(userId)).emit("campaignStatusChanged", {
            campaignId: String(campaignId),
            status: newStatus
          });
          console.log(`[EmailProcessor] Campaign ${campaign.name} → ${newStatus}`);
        }
      }
    }
  } catch (error) {
    console.error("[EmailProcessor] Critical Error:", error);
  }
};

const startProcessor = (): void => {
  console.log("🚀 Starting Multi-Tenant Email Processor...");
  setInterval(processQueue, 20 * 1000);
};

export default startProcessor;