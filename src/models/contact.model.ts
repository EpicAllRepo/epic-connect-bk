import mongoose, { Schema, Document } from 'mongoose';

export interface IContact extends Document {
  email: string;
  name?: string;
  lists: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const ContactSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String },
  lists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'List' }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IContact>('Contact', ContactSchema);
