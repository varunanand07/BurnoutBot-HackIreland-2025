import { google } from "googleapis";
import { oauth2Client } from "../api/auth.js";
import moment from 'moment-timezone';
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const calendar = google.calendar({ version: "v3", auth: oauth2Client });

// Initialize OpenAI with your API key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const getEventsSpecific = async (req, res) => {
    const { calendarId } = req.params;
    
    try {
        const eventsResponse = await calendar.events.list({
            calendarId,
            timeMin: new Date().toISOString(),
            maxResults: 50,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = eventsResponse.data.items.map(event => ({
            id: event.id,
            title: event.summary,
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            location: event.location || 'N/A',
            description: event.description || 'No description',
        }));

        res.json({ success: true, events });
    } catch (error) {
        console.error(`Error fetching events for calendar ${calendarId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to fetch events from the specified calendar' });
    }
};

// Route to add an event to a specific calendar
export const createEventSpecific = async (req, res) => {
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
};

// Route to remove an event from a specific calendar
export const deleteEventSpecific = async (req, res) => {
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
};

// Route to fetch user's calendars
export const getAllCalendars = async (req, res) => {
    try {
        const response = await calendar.calendarList.list();
        res.json(response.data.items);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch calendars' });
    }
};

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
            description,
            start: {
                dateTime: startTime,
                timeZone: "UTC"
            },
            end: {
                dateTime: endTime,
                timeZone: "UTC"
            },
            attendees: attendees?.map(email => ({ email })) || []
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

export const getTimeInEventsPerDay = async (req, res) => {
    const { calendarId, day } = req.params;
    
    try {
        const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const dayIndex = weekdays.indexOf(day.toLowerCase());
        
        if (dayIndex === -1) {
            return res.status(400).json({ success: false, message: 'Invalid day parameter. Use full weekday names (e.g., Monday, Tuesday).' });
        }

        // Get the start and end time of the requested day in the current week
        const referenceDate = moment().startOf('week').add(dayIndex, 'days');
        const startOfDay = referenceDate.startOf('day').toISOString();
        const endOfDay = referenceDate.endOf('day').toISOString();

        const eventsResponse = await calendar.events.list({
            calendarId,
            timeMin: startOfDay,
            timeMax: endOfDay,
            singleEvents: true,
            orderBy: 'startTime',
        });

        let totalMinutes = 0;
        eventsResponse.data.items.forEach(event => {
            if (event.start?.dateTime && event.end?.dateTime) {
                const startTime = new Date(event.start.dateTime);
                const endTime = new Date(event.end.dateTime);
                totalMinutes += (endTime - startTime) / 60000; // Convert ms to minutes
            }
        });

        res.json({ success: true, totalMinutes });
    } catch (error) {
        console.error(`Error calculating total event time for calendar ${calendarId} on ${day}:`, error);
        res.status(500).json({ success: false, message: 'Failed to calculate total event time' });
    }
};

export const getUserEvents = async (userEmail) => {
    try {
        const calendarListResponse = await calendar.calendarList.list();
        console.log("Calendars:", calendarListResponse.data.items);
        
        const calendars = calendarListResponse.data.items || [];

        if (!calendars.length) {
            return { success: false, message: "No calendars found." };
        }

        let userEvents = [];
        for (const cal of calendars) {
            try {
                const eventsResponse = await calendar.events.list({
                    calendarId: cal.id,
                    timeMin: new Date().toISOString(),
                    maxResults: 50,
                    singleEvents: true,
                    orderBy: "startTime",
                });


                console.log(`Raw events for calendar ${cal.summary} (${cal.id}):`, eventsResponse.data.items);

                const events = eventsResponse.data.items
                    .filter(event => event.attendees?.some(a => a.email === userEmail)) // Filter user-specific events
                    .map(event => ({
                        calendarName: cal.summary,
                        calendarId: cal.id,
                        id: event.id,
                        title: event.summary,
                        start: event.start.dateTime || event.start.date,
                        end: event.end.dateTime || event.end.date,
                        location: event.location || "N/A",
                        description: event.description || "No description",
                    }));
                console.log(events);
                

                userEvents.push(...events);
            } catch (err) {
                console.error(`Error fetching events for calendar ${cal.id}:`, err);
            }
        }

        return userEvents;
    } catch (error) {
        console.error("Error fetching user events:", error);
        return [];
    }
};

export const getMeetingLink = async (req, res) => {
    const { calendarId, eventId } = req.params;

    try {
        const eventResponse = await calendar.events.get({
            calendarId,
            eventId,
        });

        const eventData = eventResponse.data;
        const meetingLink = eventData.hangoutLink || "No meeting link available for this event";

        res.json({ success: true, meetingLink });

    } catch (error) {
        console.error("Error fetching meeting link:", error);
        res.status(500).json({ success: false, message: "Failed to fetch meeting link" });
    }
};

export const summarizeMeetingDescription = async (req, res) => {
    const { calendarId, eventId } = req.params;

    try {
        const eventResponse = await calendar.events.get({
            calendarId,
            eventId,
        });

        const eventData = eventResponse.data;
        const description = eventData.description || "No description provided";

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: `Summarize the following meeting description in one sentence:\n\n${description}` }],
            max_tokens: 50,
        });

        const summary = response.choices[0].message.content || "No summary generated";

        res.json({ success: true, summary });

    } catch (error) {
        console.error("Error summarizing meeting description:", error);
        res.status(500).json({ success: false, message: "Failed to summarize meeting description" });
    }
};