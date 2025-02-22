// src/controllers/calendarController.js
import { google } from "googleapis";
import { oauth2Client } from "../api/auth.js";

const calendar = google.calendar({ version: "v3", auth: oauth2Client });

export const getAllEvents = async (req, res) => {
    try {
        const calendarListResponse = await calendar.calendarList.list();
        const calendars = calendarListResponse.data.items || [];

        if (!calendars.length) {
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
};

export const createEvent = async (req, res) => {
    try {
        const { summary, description, startTime, endTime, attendees, location } = req.body;

        if (!summary || !startTime || !endTime) {
            return res.status(400).json({ success: false, message: "Missing required fields: summary, startTime, endTime" });
        }

        const event = {
            summary,
            location: location || "Online",
            description: description || "No description",
            start: { dateTime: startTime, timeZone: "Asia/Kolkata" },
            end: { dateTime: endTime, timeZone: "Asia/Kolkata" },
            attendees: attendees?.map(email => ({ email })) || [],
        };

        const response = await calendar.events.insert({
            calendarId: "primary",
            resource: event,
        });

        res.json({ success: true, message: "Meeting created successfully!", event: response.data });

    } catch (error) {
        console.error("Error creating event:", error);
        res.status(500).json({ success: false, message: "Failed to create event" });
    }
};