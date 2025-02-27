import express from "express";
import { getAllEvents, createEventSpecific, deleteEventSpecific, getAllCalendars, getEventsSpecific, getTimeInEventsPerDay } from "../controllers/calendarController.js";
import checkAuth from "../middleware/checkAuth.js";
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent } from '../api/calendar.js';
import { requirePermission } from '../auth/rbac.js';
import { logger, auditLog } from '../utils/logger.js';

const router = express.Router();

router.get("/events/all", checkAuth, getAllEvents);
router.get("/calendars", checkAuth, getAllCalendars);
//router.post("/events/create", checkAuth, createEvent);
router.get("/events/:calendarId", checkAuth, getEventsSpecific);
router.post("/events/:calendarId", checkAuth, createEventSpecific);
router.delete("/events/:calendarId/:eventId", checkAuth, deleteEventSpecific);

router.get("/events/:calendarId/:day/total-time", checkAuth, getTimeInEventsPerDay);

// Get calendar events
router.get('/events', async (req, res) => {
  try {
    const { accessToken, timeMin, timeMax, calendarId } = req.query;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const events = await getCalendarEvents(
      accessToken,
      timeMin || new Date().toISOString(),
      timeMax || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      calendarId || 'primary'
    );
    
    res.json(events);
  } catch (error) {
    logger.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Create calendar event
router.post('/events', requirePermission('modify_team_calendar'), async (req, res) => {
  try {
    const { accessToken, eventDetails, calendarId } = req.body;
    
    if (!accessToken || !eventDetails) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const event = await createCalendarEvent(
      accessToken,
      eventDetails,
      calendarId || 'primary'
    );
    
    // Log event creation
    await auditLog(req.user.id, 'CALENDAR_EVENT_CREATED', {
      eventId: event.id,
      summary: eventDetails.summary
    });
    
    res.json(event);
  } catch (error) {
    logger.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// Update calendar event
router.put('/events/:eventId', requirePermission('modify_team_calendar'), async (req, res) => {
  try {
    const { eventId } = req.params;
    const { accessToken, eventDetails, calendarId } = req.body;
    
    if (!accessToken || !eventDetails) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const event = await updateCalendarEvent(
      accessToken,
      eventId,
      eventDetails,
      calendarId || 'primary'
    );
    
    // Log event update
    await auditLog(req.user.id, 'CALENDAR_EVENT_UPDATED', {
      eventId,
      summary: eventDetails.summary
    });
    
    res.json(event);
  } catch (error) {
    logger.error('Error updating calendar event:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

export default router;
