import mongoose, { Schema, Document } from 'mongoose';

export interface ICampaign extends Document {
  name: string;
  subject: string;
  body: string;
  lists: mongoose.Types.ObjectId[];
  status: 'draft' | 'scheduled' | 'processing' | 'completed' | 'failed';
  scheduleType: 'immediate' | 'specific-time' | 'interval';
  startTime: Date;
  intervalMinutes: number;
  stats: {
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
  };
  createdAt: Date;
}

const CampaignSchema: Schema = new Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  lists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'List' }],
  status: { 
    type: String, 
    enum: ['draft', 'scheduled', 'processing', 'completed', 'failed'], 
    default: 'draft' 
  },
  scheduleType: {
    type: String,
    enum: ['immediate', 'specific-time', 'interval'],
    default: 'immediate'
  },
  startTime: { type: Date, default: Date.now },
  intervalMinutes: { type: Number, default: 0 },
  stats: {
    sent: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<ICampaign>('Campaign', CampaignSchema);
