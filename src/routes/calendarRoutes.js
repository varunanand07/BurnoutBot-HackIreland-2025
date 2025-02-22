import express from 'express';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// OAuth2 Client for user authentication
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

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
      // Step 1: Get all calendars
      const calendarListResponse = await calendar.calendarList.list();
      const calendars = calendarListResponse.data.items;

      if (!calendars || calendars.length === 0) {
          return res.json({ success: false, message: 'No calendars found.' });
      }

      let allEvents = [];

      // Step 2: Iterate through each calendar and fetch its events
      for (const cal of calendars) {
          try {
              const eventsResponse = await calendar.events.list({
                  calendarId: cal.id,
                  timeMin: new Date().toISOString(), // Fetch upcoming events
                  maxResults: 50, // Increase if needed
                  singleEvents: true,
                  orderBy: 'startTime',
              });

              const events = eventsResponse.data.items.map(event => ({
                  calendarName: cal.summary, // Calendar name
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

router.get('/calendars', checkAuth, async (req, res) => {
  try {
      const response = await calendar.calendarList.list();
      res.json(response.data.items);
  } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch calendars' });
  }
});


export default router;
