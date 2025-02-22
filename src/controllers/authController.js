// src/controllers/authController.js
import { oauth2Client, getAuthUrl } from "../api/auth.js";

export const googleAuth = (req, res) => {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
};

export const googleCallback = async (req, res) => {
    try {
        const { code } = req.query;
        const { tokens } = await oauth2Client.getToken(code);
        
        oauth2Client.setCredentials(tokens);

        res.json({
            success: true,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expiry_date,
        });
    } catch (error) {
        console.error("Error during authentication:", error);
        res.status(500).json({ success: false, message: "Authentication failed" });
    }
};