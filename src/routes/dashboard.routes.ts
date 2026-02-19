import express from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware";

const router = express.Router();
router.use(verifyToken);
router.use(authorizeRoles(["admin"]));

router.get('/', getDashboardStats);

export default router;
