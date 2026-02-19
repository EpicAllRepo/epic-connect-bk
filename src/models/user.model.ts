import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  role: "superAdmin" | "admin";
  otp?: string;
  otpExpiry?: Date;
  isActive: boolean;
}

const UserSchema: Schema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    role: {
      type: String,
      enum: ["superAdmin", "admin"],
      required: true,
    },
    otp: { type: String },
    otpExpiry: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
