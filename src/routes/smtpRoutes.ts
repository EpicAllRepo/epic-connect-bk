import express from 'express';
import { getSMTPConfig, saveSMTPConfig, updateSMTPConfig } from '../controllers/smtpController';

const router = express.Router();

router.get('/', getSMTPConfig);
router.post('/', saveSMTPConfig);
router.put('/', updateSMTPConfig);

export default router;
