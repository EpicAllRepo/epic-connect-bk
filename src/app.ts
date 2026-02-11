import express from 'express';
import cors from 'cors';
import campaignRoutes from './routes/campaign.routes';
import contactRoutes from './routes/contact.routes';
import listRoutes from './routes/list.routes';
import smtpRoutes from './routes/smtp.routes';
import dashboardRoutes from './routes/dashboard.routes';
import sentRoutes from './routes/sent.routes';


const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Middleware - CORS: allow sab (Postman, browser, koi bhi origin)
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/smtp', smtpRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sent', sentRoutes);


export default app;
