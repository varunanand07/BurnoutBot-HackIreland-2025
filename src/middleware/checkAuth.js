import { oauth2Client } from "../api/auth.js";

const checkAuth = async (req, res, next) => {
    const accessToken = req.headers.authorization?.split(" ")[1];

    if (!accessToken) {
        return res.status(401).json({ success: false, message: "No access token provided" });
    }

    oauth2Client.setCredentials({ access_token: accessToken });

    try {
        await oauth2Client.getTokenInfo(accessToken);
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: "Invalid or expired access token" });
    }
};

export default checkAuth;