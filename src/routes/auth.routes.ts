import express from "express";
import {
    loginUser,
    verifyOtp,
    createAdmin,
    getAllAdmins,
    deleteAdmin,
    refreshAccessToken,
    logoutUser
} from "../controllers/auth.controller";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/login", loginUser);
router.post("/verify-otp", verifyOtp);
// SuperAdmin only routes
router.get(
  "/admins",
  verifyToken,
  authorizeRoles(["superAdmin"]),
  getAllAdmins
);

router.delete(
  "/admin/:id",
  verifyToken,
  authorizeRoles(["superAdmin"]),
  deleteAdmin
);

router.post(
  "/create-admin",
  verifyToken,
  authorizeRoles(["superAdmin"]),
  createAdmin
);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logoutUser);

export default router;
