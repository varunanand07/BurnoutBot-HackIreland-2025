import express from "express";
import { getAllEvents, createEvent } from "../controllers/calendarController.js";
import checkAuth from "../middleware/checkAuth.js";

const router = express.Router();

router.get("/events/all", checkAuth, getAllEvents);
router.post("/events/create", checkAuth, createEvent);

<<<<<<< HEAD
// Middleware to check authentication token
const checkAuth = (req, res, next) => {
    const accessToken = req.headers.authorization?.split(' ')[1]; // Expecting "Bearer <token>"
    
    if (!accessToken) {
        return res.status(401).json({ success: false, message: 'No access token provided' });
    }

    oauth2Client.setCredentials({ access_token: accessToken });
    next();
};

// Google Calendar API instance
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Route to fetch all events from all calendars
router.get('/events/all', checkAuth, async (req, res) => {
    try {
        const calendarListResponse = await calendar.calendarList.list();
        const calendars = calendarListResponse.data.items;

        if (!calendars || calendars.length === 0) {
            return res.json({ success: false, message: 'No calendars found.' });
        }

        let allEvents = [];

        for (const cal of calendars) {
            try {
                const eventsResponse = await calendar.events.list({
                    calendarId: cal.id,
                    timeMin: new Date().toISOString(),
                    maxResults: 50,
                    singleEvents: true,
                    orderBy: 'startTime',
                });

                const events = eventsResponse.data.items.map(event => ({
                    calendarName: cal.summary,
                    calendarId: cal.id,
                    id: event.id,
                    title: event.summary,
                    start: event.start.dateTime || event.start.date,
                    end: event.end.dateTime || event.end.date,
                    location: event.location || 'N/A',
                    description: event.description || 'No description',
                }));

                allEvents.push(...events);
            } catch (err) {
                console.error(`Error fetching events for calendar ${cal.id}:`, err);
            }
        }

        res.json({ success: true, events: allEvents });
    } catch (error) {
        console.error('Error fetching all calendars:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch events from all calendars' });
    }
});

// Route to fetch user's calendars
router.get('/calendars', checkAuth, async (req, res) => {
    try {
        const response = await calendar.calendarList.list();
        res.json(response.data.items);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch calendars' });
    }
});

// Route to add an event to a specific calendar
router.post('/events/:calendarId', checkAuth, async (req, res) => {
    const { calendarId } = req.params;
    const { summary, location, description, start, end } = req.body;
    
    if (!summary || !start || !end) {
        return res.status(400).json({ success: false, message: 'Missing required fields: summary, start, or end' });
    }
    
    const event = {
        summary,
        location,
        description,
        start: { dateTime: start, timeZone: 'UTC' },
        end: { dateTime: end, timeZone: 'UTC' },
    };
    
    try {
        const response = await calendar.events.insert({
            calendarId,
            resource: event,
        });
        res.status(201).json({ success: true, event: response.data });
    } catch (error) {
        console.error('Error adding event:', error);
        res.status(500).json({ success: false, message: 'Failed to add event' });
    }
});

// Route to remove an event from a specific calendar
router.delete('/events/:calendarId/:eventId', checkAuth, async (req, res) => {
    const { calendarId, eventId } = req.params;
    
    try {
        await calendar.events.delete({
            calendarId,
            eventId,
        });
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
});

export default router;
=======
export default router;
>>>>>>> ecd19995dcbebd6d3df1125a967fb87c1bfd934b
