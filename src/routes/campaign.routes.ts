import express from 'express';
import { createCampaign, getCampaigns, deleteCampaign, getCampaignStatus, trackOpen, trackClick, trackDelivery } from '../controllers/campaign.controller';

const router = express.Router();

router.get('/', getCampaigns);
router.post('/', createCampaign);
router.get('/:id/status', getCampaignStatus);
router.delete('/:id', deleteCampaign);

// Tracking Routes
router.get('/track/open/:jobId', trackOpen);
router.get('/track/click/:jobId', trackClick);
router.post('/track/delivery/:jobId', trackDelivery);

export default router;
