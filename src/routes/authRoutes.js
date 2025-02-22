import express from 'express';
import dotenv from "dotenv";
import { google } from 'googleapis';

dotenv.config();

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

router.get('/google', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar'],
    });
    res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
    console.log(process.env.GOOGLE_CLIENT_ID);
    const { code } = req.query;
    console.log('Authorization Code:', code);
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Tokens:', tokens);
    
    res.send('Authentication successful! You can now use the Calendar API.');
});

export default router;