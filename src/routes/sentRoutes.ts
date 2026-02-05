import express from 'express';
import { getSentEmails, deleteSentHistory } from '../controllers/sentController';

const router = express.Router();

router.get('/', getSentEmails);
router.delete('/:id', deleteSentHistory);

export default router;
