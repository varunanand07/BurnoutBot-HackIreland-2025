import { google } from 'googleapis';
import { getTokens } from '../auth/authProvider.js';
import { logger, auditLog } from '../utils/logger.js';
import { db } from '../firebase/firebase.js';

// Get user's calendar permissions
const getUserCalendarPermissions = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return {
        canRead: true,
        canWrite: false,
        allowedCalendars: ['primary'],
        restrictedCalendars: []
      };
    }
    
    const userData = userDoc.data();
    return userData.calendarPermissions || {
      canRead: true,
      canWrite: false,
      allowedCalendars: ['primary'],
      restrictedCalendars: []
    };
  } catch (error) {
    logger.error(`Error getting calendar permissions for user ${userId}:`, error);
    return {
      canRead: true,
      canWrite: false,
      allowedCalendars: ['primary'],
      restrictedCalendars: []
    };
  }
};

// Get calendar events with permission checks
export const getCalendarEvents = async (accessToken, timeMin, timeMax, calendarId = 'primary') => {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Extract user ID from token (implementation depends on your token structure)
    const userId = extractUserIdFromToken(accessToken);
    
    // Check permissions
    const permissions = await getUserCalendarPermissions(userId);
    
    if (!permissions.canRead) {
      logger.warn(`User ${userId} attempted to read calendar without permission`);
      await auditLog(userId, 'UNAUTHORIZED_CALENDAR_READ', { calendarId });
      return [];
    }
    
    if (!permissions.allowedCalendars.includes(calendarId) && 
        calendarId !== 'primary' && 
        permissions.allowedCalendars.includes('primary')) {
      logger.warn(`User ${userId} attempted to access restricted calendar: ${calendarId}`);
      await auditLog(userId, 'RESTRICTED_CALENDAR_ACCESS', { calendarId });
      return [];
    }
    
    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    // Log the access
    await auditLog(userId, 'CALENDAR_READ', { 
      calendarId, 
      timeMin, 
      timeMax,
      eventCount: response.data.items.length
    });
    
    return response.data.items;
  } catch (error) {
    logger.error('Error fetching calendar events:', error);
    throw error;
  }
};

// Create calendar event with permission checks
export const createCalendarEvent = async (accessToken, eventDetails, calendarId = 'primary') => {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Extract user ID from token
    const userId = extractUserIdFromToken(accessToken);
    
    // Check permissions
    const permissions = await getUserCalendarPermissions(userId);
    
    if (!permissions.canWrite) {
      logger.warn(`User ${userId} attempted to create calendar event without permission`);
      await auditLog(userId, 'UNAUTHORIZED_CALENDAR_WRITE', { calendarId, eventDetails });
      throw new Error('You do not have permission to create calendar events');
    }
    
    if (!permissions.allowedCalendars.includes(calendarId) && 
        calendarId !== 'primary' && 
        permissions.allowedCalendars.includes('primary')) {
      logger.warn(`User ${userId} attempted to modify restricted calendar: ${calendarId}`);
      await auditLog(userId, 'RESTRICTED_CALENDAR_WRITE', { calendarId, eventDetails });
      throw new Error('You do not have permission to modify this calendar');
    }
    
    const response = await calendar.events.insert({
      calendarId,
      resource: eventDetails,
    });
    
    // Log the creation
    await auditLog(userId, 'CALENDAR_EVENT_CREATED', { 
      calendarId, 
      eventId: response.data.id,
      eventSummary: eventDetails.summary
    });
    
    return response.data;
  } catch (error) {
    logger.error('Error creating calendar event:', error);
    throw error;
  }
};

// Helper function to extract user ID from token
// Implementation depends on your token structure
const extractUserIdFromToken = (accessToken) => {
  // This is a placeholder - implement based on your token structure
  // You might decode a JWT or look up the token in your database
  return 'user-id';
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