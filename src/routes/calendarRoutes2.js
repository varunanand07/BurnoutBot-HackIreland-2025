import express from "express";
import { google } from "googleapis";
import { oauth2Client, getAccessToken } from "../api/auth.js";

const router = express.Router();

const checkAuth = async (req, res, next) => {
    try {
        const accessToken = getAccessToken();
        
        if (!accessToken) {
            return res.status(401).json({ success: false, message: "No access token available" });
        }

        oauth2Client.setCredentials({ access_token: accessToken });
        next();
    } catch (error) {
        console.error("Authentication error:", error);
        return res.status(500).json({ success: false, message: "Authentication failed" });
    }
};

const calendar = google.calendar({ version: "v3", auth: oauth2Client });

router.get("/events/all", checkAuth, async (req, res) => {
    try {
        const calendarListResponse = await calendar.calendarList.list();
        const calendars = calendarListResponse.data.items;

        if (!calendars || calendars.length === 0) {
            return res.json({ success: false, message: "No calendars found." });
        }

        let allEvents = [];

        for (const cal of calendars) {
            try {
                const eventsResponse = await calendar.events.list({
                    calendarId: cal.id,
                    timeMin: new Date().toISOString(),
                    maxResults: 50,
                    singleEvents: true,
                    orderBy: "startTime",
                });

                const events = eventsResponse.data.items.map(event => ({
                    calendarName: cal.summary,
                    calendarId: cal.id,
                    id: event.id,
                    title: event.summary,
                    start: event.start.dateTime || event.start.date,
                    end: event.end.dateTime || event.end.date,
                    location: event.location || "N/A",
                    description: event.description || "No description",
                }));

                allEvents.push(...events);
            } catch (err) {
                console.error(`Error fetching events for calendar ${cal.id}:`, err);
            }
        }

        res.json({ success: true, events: allEvents });
    } catch (error) {
        console.error("Error fetching all calendars:", error);
        res.status(500).json({ success: false, message: "Failed to fetch events from all calendars" });
    }
});

export default router;