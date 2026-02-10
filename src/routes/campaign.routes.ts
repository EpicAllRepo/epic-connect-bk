import express from 'express';
import { createCampaign, getCampaigns, deleteCampaign, getCampaignStatus } from '../controllers/campaign.controller';

const router = express.Router();

router.get('/', getCampaigns);
router.post('/', createCampaign);
router.get('/:id/status', getCampaignStatus);
router.delete('/:id', deleteCampaign);

export default router;
