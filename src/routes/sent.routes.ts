import express from 'express';
import { getSentEmails, deleteSentHistory } from '../controllers/sent.controller';

const router = express.Router();

router.get('/', getSentEmails);
router.delete('/:id', deleteSentHistory);

export default router;
