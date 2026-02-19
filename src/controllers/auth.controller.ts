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
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
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

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" }
    );

    return res.json({
      token,
      role: user.role,
      email: user.email,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
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
