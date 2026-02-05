import express from 'express';
import { createCampaign, getCampaigns, deleteCampaign } from '../controllers/campaign.controller';

const router = express.Router();

router.get('/', getCampaigns);
router.post('/', createCampaign);
router.delete('/:id', deleteCampaign);

export default router;
