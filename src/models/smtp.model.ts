import mongoose, { Schema, Document } from 'mongoose';

export interface ISMTP extends Document {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName?: string;
  isDefault: boolean;
  createdBy: mongoose.Types.ObjectId;
}

const SMTPSchema: Schema = new Schema({
  host: { type: String, required: true },
  port: { type: Number, required: true },
  user: { type: String, required: true },
  pass: { type: String, required: true },
  fromEmail: { type: String, required: true },
  fromName: { type: String },
  isDefault: { type: Boolean, default: true },
  createdBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true,
}
});

export default mongoose.model<ISMTP>('SMTP', SMTPSchema);
