import { Request, Response } from 'express';
import mongoose from 'mongoose';
import SMTP from '../models/smtp.model';

// GET SMTP Config
export const getSMTPConfig = async (req: Request, res: Response) => {
     const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };
    try {
        const config = await SMTP.findOne({
            createdBy: userId
        });
        if (!config) return res.json({ message: 'No configuration found' });
        res.json(config);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST Create SMTP Config
export const saveSMTPConfig = async (req: Request, res: Response) => {
     const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };
    try {
        const { host, port, user, pass, fromEmail, fromName } = req.body;

        const existingConfig = await SMTP.findOne({
            createdBy: userId
        });
        if (existingConfig) {
            return res.status(400).json({ message: 'SMTP configuration already exists. Use PUT to update.' });
        }

        const config = await SMTP.create({
            host, port, user, pass, fromEmail, fromName, isDefault: true, createdBy: userId
        });

        res.status(201).json({ message: 'SMTP Configuration saved successfully', config });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};

// PUT Update SMTP Config
export const updateSMTPConfig = async (req: Request, res: Response) => {
     const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    };
    const userRole = req.user?.role;
    let config;
    try {
        const { host, port, user, pass, fromEmail, fromName } = req.body;
        const { id } = req.params;

        // 1. Check if ID is a valid MongoDB ID
        if (!mongoose.Types.ObjectId.isValid(id as string)) {
            return res.status(404).json({ message: 'Configuration not found (Invalid ID format)' });
        }

        // 2. Find data by this ID
        if (userRole === 'superadmin') {
            config = await SMTP.findById(id);
        } else {
            config = await SMTP.findOne({
                _id: id,
                createdBy: userId
            });
        }

        // 3. If NOT found, refuse (mana kar dena)
        if (!config) {
            return res.status(404).json({ message: 'SMTP configuration not found for this ID' });
        }

        // 4. If found, proceed with update
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
