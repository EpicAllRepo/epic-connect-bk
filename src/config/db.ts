import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/epic-connect';
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
