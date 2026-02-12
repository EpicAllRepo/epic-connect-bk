import mongoose, { Schema, Document } from 'mongoose';

export interface IContact extends Document {
  email: string;
  /** Optional full name (can be derived from firstName + lastName) */
  name?: string;
  firstName: string;
  lastName: string;
  lists: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const ContactSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true, trim: true },
  name: { type: String },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  lists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'List' }],
  createdAt: { type: Date, default: Date.now }
},
{timestamps: true}
);

// Backward compatibility: purane contacts jinke paas sirf "name" hai,
// unke liye response me firstName/lastName name se derive ho jaye
ContactSchema.set('toJSON', {
  transform(_doc, ret: Record<string, unknown>) {
    const first = String(ret.firstName ?? '').trim();
    const last = String(ret.lastName ?? '').trim();
    const full = String(ret.name ?? '').trim();
    if (!first && !last && full) {
      const parts = full.split(/\s+/).filter(Boolean);
      ret.firstName = parts[0] || '';
      ret.lastName = parts.slice(1).join(' ') || '';
    }
    return ret;
  }
});

export default mongoose.model<IContact>('Contact', ContactSchema);
