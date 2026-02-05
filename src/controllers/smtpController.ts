import { Request, Response } from 'express';
import SMTP from '../models/SMTP';

// GET SMTP Config
export const getSMTPConfig = async (req: Request, res: Response) => {
    try {
        // We only really support one default config for now
        const config = await SMTP.findOne({ isDefault: true });
        if (!config) return res.json({ message: 'No configuration found' });
        
        // Don't send back the password in plain text if possible, but for editing we might need it
        // For security in production, we should mask it.
        res.json(config);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST Create SMTP Config
export const saveSMTPConfig = async (req: Request, res: Response) => {
    try {
        const { host, port, user, pass, fromEmail, fromName } = req.body;

        // Check if config already exists
        const existingConfig = await SMTP.findOne({ isDefault: true });
        if (existingConfig) {
            return res.status(400).json({ message: 'SMTP configuration already exists. Use PUT to update.' });
        }

        // Create new
        const config = await SMTP.create({
            host, port, user, pass, fromEmail, fromName, isDefault: true
        });

        res.status(201).json({ message: 'SMTP Configuration saved successfully', config });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};

// PUT Update SMTP Config
export const updateSMTPConfig = async (req: Request, res: Response) => {
    try {
        const { host, port, user, pass, fromEmail, fromName } = req.body;

        let config = await SMTP.findOne({ isDefault: true });

        if (!config) {
            return res.status(404).json({ message: 'SMTP configuration not found' });
        }

        // Update fields
        if (host) config.host = host;
        if (port) config.port = port;
        if (user) config.user = user;
        if (pass) {
            const cleanPass = pass.replace(/\s/g, ''); 
            config.pass = cleanPass;
        }
        if (fromEmail) config.fromEmail = fromEmail;
        if (fromName) config.fromName = fromName;

        await config.save();

        res.json({ message: 'SMTP Configuration updated successfully', config });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};
