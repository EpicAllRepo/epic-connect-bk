import { Schema, model } from "mongoose";

const listSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    contacts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Contact"
      }
    ]
  },
  { timestamps: true }
);

export default model("List", listSchema);
