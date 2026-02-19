import express from 'express';
import { createCampaign, getCampaigns, deleteCampaign, getCampaignStatus, trackOpen, trackClick, trackDelivery } from '../controllers/campaign.controller';
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware";
const router = express.Router();

router.use(verifyToken);
router.use(authorizeRoles(["admin"]));

router.get('/', getCampaigns);
router.post('/', createCampaign);
router.get('/:id/status', getCampaignStatus);
router.delete('/:id', deleteCampaign);

// Tracking Routes
router.get('/track/open/:jobId', trackOpen);
router.get('/track/click/:jobId', trackClick);
router.post('/track/delivery/:jobId', trackDelivery);

export default router;
