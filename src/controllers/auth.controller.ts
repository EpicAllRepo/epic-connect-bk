import { Request, Response } from "express";
import User from "../models/user.model";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendOtpEmail } from "../utils/sendEmail";
import bcrypt from "bcryptjs";

// Generate 6 digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// 🔹 LOGIN (Send OTP)
export const loginUser = async (req: Request, res: Response) => {
  console.log("LOGIN REQUEST 👉", req.body);
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(403).json({
        message: "You are not allowed to access this system",
      });
    }

    const otp = generateOTP();

    // Hash OTP before saving
    const hashedOtp = await bcrypt.hash(otp, 10);

    user.otp = hashedOtp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    // Send to Gmail
    await sendOtpEmail(email, otp);

    return res.json({
      message: "OTP sent successfully",
    });
  } catch (error: any) {
    console.error("LOGIN ERROR 👉", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

// 🔹 VERIFY OTP
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });

    if (!user || !user.otp || !user.otpExpiry) {
      return res.status(400).json({ message: "Invalid request" });
    }

    if (user.otpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const isMatch = await bcrypt.compare(otp, user.otp);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Clear OTP
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Access Token (2 min)
    const accessToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "2m" }
    );

    // Refresh Token (7 days)
    const refreshToken = jwt.sign(
      {
        userId: user._id,
      },
      process.env.JWT_REFRESH_SECRET as string,
      { expiresIn: "7d" }
    );

    // ✅ Pehle purane sare tokens clear karo
    res.clearCookie("refreshToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/api" });
    res.clearCookie("refreshToken", { path: "/api/auth/refresh" });
    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("accessToken", { path: "/api" });

    const isProd = process.env.NODE_ENV === "production";

    res.cookie("accessToken", accessToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      domain: isProd ? ".epicglobal.co.in" : undefined,
      path: "/",
      maxAge: 2 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      domain: isProd ? ".epicglobal.co.in" : undefined,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      accessToken,
      role: user.role,
      email: user.email,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// 🔹 REFRESH ACCESS TOKEN
// 🔹 REFRESH ACCESS TOKEN (with rotation)
export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken;

    console.log("🔥 All cookies:", req.cookies); // ← Dekho kaun sa token aa raha hai

    if (!token) {
      return res.status(401).json({ message: "No refresh token" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET as string
    ) as any;

    console.log("🔥 Decoded userId:", decoded.userId); // ← userId check karo

    const user = await User.findById(decoded.userId);

    console.log("🔥 User found:", user?.email); // ← Sahi user aa raha hai?

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // ✅ Naya Access Token
    const newAccessToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "2m" }
    );

    // ✅ Naya Refresh Token bhi banao (Token Rotation)
    const newRefreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET as string,
      { expiresIn: "7d" }
    );

    // ✅ Purana refreshToken clear karo - sare paths se
    res.clearCookie("refreshToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/api" });
    res.clearCookie("refreshToken", { path: "/api/auth/refresh" });

    // ✅ Naya refreshToken set karo
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // ✅ Naya accessToken cookie bhi update karo
    res.cookie("accessToken", newAccessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 1000,
    });

    return res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.clearCookie("refreshToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/api" });
    return res.status(401).json({ message: "Invalid refresh token" });
  }
};

// 🔹 CREATE ADMIN (Only SuperAdmin)
export const createAdmin = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const newAdmin = await User.create({
      email,
      role: "admin",
    });

    return res.json({
      message: "Admin created successfully",
      user: newAdmin,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAllAdmins = async (req: Request, res: Response) => {
  try {
    const admins = await User.find({ role: "admin" }).select("-otp -otpExpiry");

    return res.json({
      count: admins.length,
      admins,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const admin = await User.findOne({ _id: id, role: "admin" });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    await admin.deleteOne();

    return res.json({ message: "Admin deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// 🔹 LOGOUT
export const logoutUser = async (req: Request, res: Response) => {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });
  return res.json({ message: "Logged out successfully" });
};