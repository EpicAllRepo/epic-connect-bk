import mongoose, { Schema, Document } from 'mongoose';

export interface IList extends Document {
  name: string;
  description?: string;
  contacts: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ListSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
  createdBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true,
},
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IList>('List', ListSchema);
