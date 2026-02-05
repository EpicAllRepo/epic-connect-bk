import mongoose, { Schema, Document } from 'mongoose';

export interface IList extends Document {
  name: string;
  description?: string;
  createdAt: Date;
}

const ListSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IList>('List', ListSchema);
