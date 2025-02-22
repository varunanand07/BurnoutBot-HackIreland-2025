import { google } from 'googleapis';
import { oauth2Client } from './auth.js';

export const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

export const getCalendarEvents = async (accessToken, timeMin, timeMax) => {
  try {
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items;
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
};

export const createCalendarEvent = async (accessToken, eventDetails) => {
  try {
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const event = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventDetails,
    });

    return event.data;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
};

export const updateCalendarEvent = async (accessToken, eventId, updates) => {
  try {
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const event = await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      resource: updates,
    });

    return event.data;
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw error;
  }
};

export const deleteCalendarEvent = async (accessToken, eventId) => {
  try {
    oauth2Client.setCredentials({ access_token: accessToken });
    
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    return true;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    throw error;
  }
};