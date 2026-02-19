import express from 'express';
import { getSentEmails, deleteSentHistory } from '../controllers/sent.controller';
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware";

const router = express.Router();
router.use(verifyToken);
router.use(authorizeRoles(["admin"]));

router.get('/', getSentEmails);
router.delete('/:id', deleteSentHistory);

export default router;
