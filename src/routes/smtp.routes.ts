import express from 'express';
import { getSMTPConfig, saveSMTPConfig, updateSMTPConfig } from '../controllers/smtp.controller';
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware";

const router = express.Router();
router.use(verifyToken);
router.use(authorizeRoles(["admin"]));

router.get('/', getSMTPConfig);
router.post('/', saveSMTPConfig);
router.put('/:id', updateSMTPConfig);


export default router;
