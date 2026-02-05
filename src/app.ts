import express from 'express';
import cors from 'cors';
import campaignRoutes from './routes/campaignRoutes';
import contactRoutes from './routes/contactRoutes';
import listRoutes from './routes/listRoutes';
import smtpRoutes from './routes/smtpRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import sentRoutes from './routes/sentRoutes';


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
