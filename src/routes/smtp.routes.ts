import express from 'express';
import { getSMTPConfig, saveSMTPConfig, updateSMTPConfig } from '../controllers/smtp.controller';

const router = express.Router();

router.get('/', getSMTPConfig);
router.post('/', saveSMTPConfig);
router.put('/:id', updateSMTPConfig);


export default router;
