import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailJob extends Document {
  campaignId: mongoose.Types.ObjectId;
  contactId: mongoose.Types.ObjectId;
  email: string;
  scheduledAt: Date;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  error?: string;
}

const EmailJobSchema: Schema = new Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  email: { type: String, required: true },
  scheduledAt: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'sent', 'failed'], 
    default: 'pending' 
  },
  sentAt: { type: Date },
  error: { type: String },
});

export default mongoose.model<IEmailJob>('EmailJob', EmailJobSchema);
