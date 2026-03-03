import express from 'express';
import cors from 'cors';
import campaignRoutes from './routes/campaign.routes';
import contactRoutes from './routes/contact.routes';
import listRoutes from './routes/list.routes';
import smtpRoutes from './routes/smtp.routes';
import dashboardRoutes from './routes/dashboard.routes';
import sentRoutes from './routes/sent.routes';
import authRoutes from './routes/auth.routes';
import cookieParser from "cookie-parser";


const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "https://epicconnect.epicglobal.co.in"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);


app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());


// Routes
app.use("/api/auth", authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/smtp', smtpRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sent', sentRoutes);


export default app;
  