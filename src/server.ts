import app from './app';
import dotenv from 'dotenv';
import connectDB from './config/db';
import startEmailProcessor from './utils/emailProcessor';

// Load env vars
dotenv.config();

// Connect to Database
connectDB();

// Start the Background Processor
//startEmailProcessor();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
