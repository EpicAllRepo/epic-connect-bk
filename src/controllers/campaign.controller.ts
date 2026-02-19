import { Request, Response } from 'express';
import Campaign from '../models/campaign.model';
import Contact, { IContact } from '../models/contact.model';
import EmailJob, { IEmailJob } from '../models/emailjob.model';
import mongoose from 'mongoose';
import SMTP from '../models/smtp.model';
import { io } from "../server";



export const getCampaigns = async (req: Request, res: Response) => {
  try {
    /* 🔹 1. PAGINATION PARAMS */
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;
    const skip = (page - 1) * limit;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    } // Assuming req.user is set by auth middleware

    /* 🔹 2. TOTAL CAMPAIGNS COUNT */
    const totalItems = await Campaign.countDocuments({
      createdBy: userId
    });

    /* 🔹 3. FETCH PAGINATED CAMPAIGNS */
    const campaigns = await Campaign.find({
      createdBy: userId
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("lists", "name");

    const campaignIds = campaigns.map(c => c._id);

    /* 🔹 4. AGGREGATE EMAIL STATS IN SINGLE QUERY */
    const emailStats = await EmailJob.aggregate([
      {
        $match: {
          campaignId: { $in: campaignIds },
          createdBy: userId
        }
      },
      {
        $group: {
          _id: {
            campaignId: "$campaignId",
            status: "$status"
          },
          count: { $sum: 1 }
        }
      }
    ]);

    /* 🔹 5. FORMAT EMAIL STATS INTO MAP */
    const breakdownMap: Record<string, any> = {};

    emailStats.forEach(stat => {
      const campaignId = stat._id.campaignId.toString();
      const status = stat._id.status;

      if (!breakdownMap[campaignId]) {
        breakdownMap[campaignId] = {
          total: 0,
          sent: 0,
          scheduled: 0,
          draft: 0
        };
      }

      breakdownMap[campaignId].total += stat.count;

      if (status === "sent") {
        breakdownMap[campaignId].sent = stat.count;
      }

      if (status === "pending") {
        breakdownMap[campaignId].scheduled = stat.count;
      }

      if (status === "failed") {
        breakdownMap[campaignId].draft = stat.count;
      }
    });

    /* 🔹 6. ATTACH BREAKDOWN AND CLEAN STATS TO CAMPAIGNS */
    const campaignsWithStats = campaigns.map(campaign => {
      const breakdown =
        breakdownMap[campaign._id.toString()] || {
          total: 0,
          sent: 0,
          scheduled: 0,
          draft: 0
        };

      // 🔹 Ensure consistent analytics structure for the list view
      const dbStats = campaign.stats || {};
      const failed = dbStats.failed || (dbStats as any).bounced || 0;
      const sent = dbStats.sent || 0;
      const totalRecipients = campaign.totalRecipients || 0;

      const cleanStats = {
        sent,
        delivered: dbStats.delivered || 0,
        opened: dbStats.opened || 0,
        clicked: dbStats.clicked || 0,
        failed: failed,
        scheduled: Math.max(0, totalRecipients - (sent + failed))
      };

      return {
        ...campaign.toObject(),
        stats: cleanStats, // 🚀 Override with clean/updated stats
        emailBreakdown: breakdown
      };
    });

    /* 🔹 7. GLOBAL STATS */
    const statsAgg = await Campaign.aggregate([
      {
        $match: {
          createdBy: new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          scheduledCampaigns: {
            $sum: {
              $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0]
            }
          },
          totalSent: { $sum: "$stats.sent" }
        }
      }
    ]);

    /* 🔹 8. FINAL RESPONSE */
    res.json({
      campaigns: campaignsWithStats,
      stats: {
        totalCampaigns: statsAgg[0]?.totalCampaigns || 0,
        scheduledCampaigns: statsAgg[0]?.scheduledCampaigns || 0,
        totalSent: statsAgg[0]?.totalSent || 0,
        totalRecipients: campaigns.reduce(
          (acc, c) => acc + (c.totalRecipients || 0),
          0
        )
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        limit
      }
    });

  } catch (err: any) {
    res.status(500).json({
      message: err.message || "Failed to fetch campaigns"
    });
  }
};

export const createCampaign = async (req: Request, res: Response) => {
  try {
    const { name, subject, body, listIds, contactIds, intervalMinutes } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };

    const smtp = await SMTP.findOne({ createdBy: userId });
    if (!smtp || !smtp.host || !smtp.user || !smtp.pass) {
      return res.status(400).json({
        success: false,
        code: "SMTP_NOT_CONFIGURED",
        message: "Please confirm your SMTP settings before creating a campaign."
      });
    }

    // 1. Create the Campaign (status will be updated by emailProcessor)
    const campaign = await Campaign.create({
      name,
      subject,
      body,
      lists: listIds || [],
      scheduleType: intervalMinutes && intervalMinutes > 0 ? 'interval' : 'immediate',
      intervalMinutes: intervalMinutes || 0,
      status: 'scheduled',
      totalRecipients: 0,  // Will be updated after counting contacts
      createdBy: userId
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

    const contacts = await Contact.find({
      createdBy: userId,
      $or: conditions
    });

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
        status: 'pending',
        createdBy: new mongoose.Types.ObjectId(userId)
      });
    });


    await EmailJob.insertMany(jobs);

    // 4. Update campaign with totalRecipients
    await Campaign.findByIdAndUpdate(campaign._id, {
      totalRecipients: uniqueContacts.length
    });
    io.to(userId.toString()).emit("campaignUpdated", {
      campaignId: campaign._id,
      type: "created"
    });

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

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };

    // 1. Delete associated email jobs
    await EmailJob.deleteMany({ campaignId: id, createdBy: userId });

    // 2. Delete the campaign
    const campaign = await Campaign.findOneAndDelete({
      _id: id,
      createdBy: userId
    });

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    res.json({ message: "Campaign and its email jobs deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

export const getCampaignStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };
    const campaign = await Campaign.findOne({
      _id: id,
      createdBy: userId
    }).populate('lists', 'name');
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    // Calculate Analytics
    const stats = campaign.stats || { sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 };
    const totalRecipients = campaign.totalRecipients || 0;

    // Count job statuses for progress bar and backward compatibility
    const [totalJobs, sentJobs, failedJobs, pendingJobs] = await Promise.all([
      EmailJob.countDocuments({ campaignId: id, createdBy: userId }),
      EmailJob.countDocuments({ campaignId: id, status: 'sent', createdBy: userId }),
      EmailJob.countDocuments({ campaignId: id, status: 'failed', createdBy: userId }),
      EmailJob.countDocuments({ campaignId: id, status: 'pending', createdBy: userId })
    ]);

    // scheduled + sent + failed = totalRecipients (Precision for new Analytics)
    const scheduled = Math.max(0, totalRecipients - (stats.sent + stats.failed));

    // Calculated Rates
    const deliveryRate = stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : "0.0";
    const openRate = stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(1) : "0.0";
    const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : "0.0";

    // Progress percentage for frontend
    const progress = totalJobs > 0 ? Math.round(((sentJobs + failedJobs) / totalJobs) * 100) : 0;

    res.json({
      campaign: {
        id: campaign._id,
        name: campaign.name,
        status: campaign.status,
        totalRecipients: totalRecipients || totalJobs,
        createdAt: campaign.createdAt
      },
      // 🔹 For NEW Analytics Dashboard (As per screenshot)
      analytics: {
        totalRecipients,
        scheduled,
        sent: stats.sent,
        delivered: stats.delivered,
        opened: stats.opened,
        clicked: stats.clicked,
        failed: stats.failed,
        rates: {
          deliveryRate: `${deliveryRate}%`,
          openRate: `${openRate}%`,
          clickRate: `${clickRate}%`
        }
      },
      // 🔹 For OLD Frontend compatibility (Progress bar etc)
      emailStats: {
        total: totalRecipients || totalJobs,
        sent: sentJobs,
        draft: failedJobs,
        scheduled: pendingJobs,
        progress: `${progress}%`
      },
      stats: campaign.stats
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 TRACK EMAIL OPEN
export const trackOpen = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = await EmailJob.findById(jobId);
    if (!job) return res.status(404).end();

    if (!job.isOpened) {
      job.isOpened = true;
      job.openedAt = new Date();
      await job.save();

      await Campaign.updateOne(
        { _id: job.campaignId },
        { $inc: { "stats.opened": 1 } }
      );

      // ✅ SOCKET EMIT
      io.to(String(job.createdBy)).emit("campaignStatsUpdated", {
        campaignId: String(job.campaignId),
        type: "opened"
      });
    }

    const pixel = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64"
    );

    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Content-Length", pixel.length);
    res.end(pixel);

  } catch (err: any) {
    console.error("Track open error:", err.message);
    res.status(500).end();
  }
};

// 🔹 TRACK LINK CLICK
export const trackClick = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { url } = req.query;

    const job = await EmailJob.findById(jobId);
    if (!job) return res.redirect(process.env.CLIENT_URL || "/");

    if (!job.isClicked) {
      job.isClicked = true;
      job.clickedAt = new Date();
      await job.save();

      await Campaign.updateOne(
        { _id: job.campaignId },
        { $inc: { "stats.clicked": 1 } }
      );

      io.to(String(job.createdBy)).emit("campaignStatsUpdated", {
        campaignId: String(job.campaignId),
        type: "clicked"
      });
    }

    const redirectUrl = url
      ? decodeURIComponent(url as string)
      : process.env.CLIENT_URL || "/";

    return res.redirect(redirectUrl);

  } catch (err: any) {
    console.error("Track click error:", err.message);
    return res.redirect(process.env.CLIENT_URL || "/");
  }
};

// 🔹 TRACK DELIVERY (Webhook Simulator)
export const trackDelivery = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    console.log(`[TRACK] Delivery triggered for Job: ${jobId}`);

    const job = await EmailJob.findById(jobId);

    if (job && !job.isDelivered) {
      job.isDelivered = true;
      await job.save();

      // Increment Campaign Delivered Count
      await Campaign.findByIdAndUpdate(job.campaignId, {
        $inc: { 'stats.delivered': 1 }
      });
      console.log(`[TRACK] Campaign ${job.campaignId} stats updated: Delivered +1`);
    }

    res.json({ success: true, message: "Delivery tracked" });
  } catch (err: any) {
    console.error(`[TRACK ERROR] Delivery:`, err.message);
    res.status(500).json({ success: false });
  }
};
