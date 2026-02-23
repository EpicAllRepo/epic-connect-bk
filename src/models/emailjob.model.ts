import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailJob extends Document {
  campaignId: mongoose.Types.ObjectId;
  contactId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  email: string;
  scheduledAt: Date;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  error?: string;
  isDelivered?: boolean;
  openedAt?: Date;
  clickedAt?: Date;
  isOpened?: boolean;
  isClicked?: boolean;
}

const EmailJobSchema: Schema = new Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  email: { type: String, required: true },
  scheduledAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  sentAt: { type: Date },
  error: { type: String },
  isDelivered: { type: Boolean, default: false },
  openedAt: {
    type: Date,
    default: null,
  },
  clickedAt: {
    type: Date,
    default: null,
  },
  isOpened: { type: Boolean, default: false },
  isClicked: { type: Boolean, default: false },
});

export default mongoose.model<IEmailJob>('EmailJob', EmailJobSchema);
