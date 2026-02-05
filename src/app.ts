import express from 'express';
import cors from 'cors';
import campaignRoutes from './routes/campaign.routes';
import contactRoutes from './routes/contact.routes';
import listRoutes from './routes/list.routes';
import smtpRoutes from './routes/smtp.routes';
import dashboardRoutes from './routes/dashboard.routes';
import sentRoutes from './routes/sent.routes';


const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/smtp', smtpRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sent', sentRoutes);


export default app;
