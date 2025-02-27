import { getUserEvents } from "../controllers/calendarController.js";
import { calculateBurnoutScore } from "../controllers/burnoutController.js";
import { getCalendarEvents } from '../api/calendar.js';
import { logger, auditLog } from '../utils/logger.js';

const WORK_HOURS = { start: 9, end: 18 }; 
const MIN_BREAK_TIME = 15;
const MAX_MEETING_HOURS = 6;

/**
 * Find optimal meeting slots based on participants' calendars
 * @param {Array} participants - Array of participant objects with tokens
 * @param {Number} duration - Meeting duration in minutes
 * @returns {Array} - Array of available time slots
 */
export const findOptimalMeetingSlot = async (participants, duration) => {
    try {
        let busyIntervals = [];
        let burnoutScores = {};
        const now = new Date();
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        // Step 1: Fetch meetings for all participants
        for (let participant of participants) {
            if (!participant.token) {
                logger.warn(`No token available for participant: ${participant.id || participant.email}`);
                continue;
            }
            
            const events = await getCalendarEvents(
                participant.token,
                now.toISOString(),
                nextWeek.toISOString()
            );
            
            // Log the calendar access
            await auditLog(participant.id || 'anonymous', 'CALENDAR_READ_FOR_SCHEDULING', {
                eventCount: events.length,
                timeRange: `${now.toISOString()} to ${nextWeek.toISOString()}`
            });
            
            // Calculate burnout score if available
            if (typeof calculateBurnoutScore === 'function') {
                const burnout = calculateBurnoutScore(events);
                burnoutScores[participant.id || participant.email] = burnout.burnoutScore;
            }
            
            // Add busy intervals
            events.forEach((event) => {
                if (event.start && event.end) {
                    busyIntervals.push({
                        start: new Date(event.start.dateTime || event.start.date),
                        end: new Date(event.end.dateTime || event.end.date),
                    });
                }
            });
        }
        
        // Step 2: Merge all busy times & sort them
        busyIntervals.sort((a, b) => a.start - b.start);
        
        // Step 3: Find available time slots
        let availableSlots = [];
        let currentDay = new Date(now);
        currentDay.setHours(0, 0, 0, 0);
        
        // Look for slots in the next 5 business days
        for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
            // Skip weekends
            if (currentDay.getDay() === 0 || currentDay.getDay() === 6) {
                currentDay.setDate(currentDay.getDate() + 1);
                continue;
            }
            
            let currentTime = new Date(currentDay);
            currentTime.setHours(WORK_HOURS.start, 0, 0, 0);
            
            let workEndTime = new Date(currentDay);
            workEndTime.setHours(WORK_HOURS.end, 0, 0, 0);
            
            // Filter busy intervals for current day
            const todaysBusyIntervals = busyIntervals.filter(interval => 
                interval.start.getDate() === currentDay.getDate() &&
                interval.start.getMonth() === currentDay.getMonth() &&
                interval.start.getFullYear() === currentDay.getFullYear()
            );
            
            // Find free slots between meetings
            while (currentTime < workEndTime) {
                let nextBusyTime = workEndTime;
                
                // Find the next busy time after current time
                for (const interval of todaysBusyIntervals) {
                    if (interval.start > currentTime && interval.start < nextBusyTime) {
                        nextBusyTime = interval.start;
                    }
                }
                
                // Check if there's enough time for the meeting
                const availableDuration = (nextBusyTime - currentTime) / (60 * 1000);
                if (availableDuration >= duration) {
                    availableSlots.push({
                        startTime: new Date(currentTime).toISOString(),
                        endTime: new Date(currentTime.getTime() + duration * 60000).toISOString(),
                        durationMinutes: duration
                    });
                }
                
                // Move to the next busy interval's end time
                const nextInterval = todaysBusyIntervals.find(interval => 
                    interval.start <= nextBusyTime && interval.end > nextBusyTime
                );
                
                if (nextInterval) {
                    currentTime = new Date(nextInterval.end);
                } else {
                    // If no more busy intervals, move to end of day
                    currentTime = new Date(workEndTime);
                }
            }
            
            // Move to next day
            currentDay.setDate(currentDay.getDate() + 1);
        }
        
        // Step 4: Score and rank the available slots
        const scoredSlots = availableSlots.map(slot => {
            const slotTime = new Date(slot.startTime);
            const hour = slotTime.getHours();
            
            // Prefer morning slots for important meetings
            let timeOfDayScore = 0;
            if (hour >= 9 && hour <= 11) {
                timeOfDayScore = 10; // Morning slots are best
            } else if (hour >= 14 && hour <= 16) {
                timeOfDayScore = 8;  // Afternoon slots are good
            } else if (hour >= 12 && hour < 14) {
                timeOfDayScore = 5;  // Lunch time is not ideal
            } else {
                timeOfDayScore = 3;  // Early morning or late afternoon
            }
            
            return {
                ...slot,
                score: timeOfDayScore
            };
        });
        
        // Sort by score (highest first)
        scoredSlots.sort((a, b) => b.score - a.score);
        
        // Return top 5 slots
        return scoredSlots.slice(0, 5);
    } catch (error) {
        logger.error('Error finding optimal meeting slots:', error);
        throw error;
    }
};

/**
 * Find focus time blocks in a calendar
 * @param {Array} events - Calendar events
 * @returns {Array} - Array of focus time blocks
 */
export const findFocusTimeBlocks = (events) => {
    try {
        const busyIntervals = events.map(event => ({
            start: new Date(event.start.dateTime || event.start.date),
            end: new Date(event.end.dateTime || event.end.date)
        }));
        
        busyIntervals.sort((a, b) => a.start - b.start);
        
        const focusBlocks = [];
        const now = new Date();
        const endOfWeek = new Date(now);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        
        let currentDay = new Date(now);
        currentDay.setHours(0, 0, 0, 0);
        
        // Look for focus blocks in the next 5 business days
        for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
            // Skip weekends
            if (currentDay.getDay() === 0 || currentDay.getDay() === 6) {
                currentDay.setDate(currentDay.getDate() + 1);
                continue;
            }
            
            let currentTime = new Date(currentDay);
            currentTime.setHours(WORK_HOURS.start, 0, 0, 0);
            
            let workEndTime = new Date(currentDay);
            workEndTime.setHours(WORK_HOURS.end, 0, 0, 0);
            
            // Filter busy intervals for current day
            const todaysBusyIntervals = busyIntervals.filter(interval => 
                interval.start.getDate() === currentDay.getDate() &&
                interval.start.getMonth() === currentDay.getMonth() &&
                interval.start.getFullYear() === currentDay.getFullYear()
            );
            
            // Find free slots between meetings
            while (currentTime < workEndTime) {
                let nextBusyTime = workEndTime;
                
                // Find the next busy time after current time
                for (const interval of todaysBusyIntervals) {
                    if (interval.start > currentTime && interval.start < nextBusyTime) {
                        nextBusyTime = interval.start;
                    }
                }
                
                // Check if there's enough time for a focus block (at least 90 minutes)
                const availableDuration = (nextBusyTime - currentTime) / (60 * 1000);
                if (availableDuration >= 90) {
                    focusBlocks.push({
                        startTime: new Date(currentTime).toISOString(),
                        endTime: new Date(nextBusyTime).toISOString(),
                        durationMinutes: availableDuration
                    });
                }
                
                // Move to the next busy interval's end time
                const nextInterval = todaysBusyIntervals.find(interval => 
                    interval.start <= nextBusyTime && interval.end > nextBusyTime
                );
                
                if (nextInterval) {
                    currentTime = new Date(nextInterval.end);
                } else {
                    // If no more busy intervals, move to end of day
                    currentTime = new Date(workEndTime);
                }
            }
            
            // Move to next day
            currentDay.setDate(currentDay.getDate() + 1);
        }
        
        return focusBlocks;
    } catch (error) {
        logger.error('Error finding focus time blocks:', error);
        return [];
    }
};

/**
 * API Endpoint: Finds the best available meeting slot.
 */
const scheduleMeeting = async (req, res) => {
    try {
        const { participants, duration } = req.body;

        if (!participants || !duration) {
            return res.status(400).json({ error: "Participants and meeting duration are required" });
        }

        // Find the best time slot
        const availableSlots = await findOptimalMeetingSlot(participants, duration);
        
        res.json({ suggestedTimeSlots: availableSlots });
    } catch (error) {
        console.error("Error scheduling meeting:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const scheduleMeeting2 = async (req,res) => {
    const { calendarId } = req.params;  // Calendar ID from URL
    const { summary, description, startTime, endTime, attendees, location } = req.body;  // Meeting details

    // Validate input
    if (!summary || !startTime || !endTime) {
        return res.status(400).json({ success: false, message: "Missing required fields: summary, startTime, endTime" });
    }

    const event = {
        summary,
        location: location || "Online",
        description: description || "No description",
        start: { dateTime: startTime, timeZone: "UTC" },
        end: { dateTime: endTime, timeZone: "UTC" },
        attendees: attendees?.map(email => ({ email })) || [],
        reminders: {
            useDefault: false,
            overrides: [
                { method: "email", minutes: 30 },
                { method: "popup", minutes: 10 },
            ],
        },
    };

    try {
        const response = await calendar.events.insert({
            calendarId,
            resource: event,
        });

        res.status(201).json({ success: true, message: "Meeting scheduled successfully!", event: response.data });

    } catch (error) {
        console.error("Error scheduling meeting:", error);
        res.status(500).json({ success: false, message: "Failed to schedule meeting" });
    }
}

const rescheduleMeeting = async (req,res) => {
    const { calendarId, eventId } = req.params;
    const { newStart, newEnd } = req.body;

    // Validate input
    if (!newStart || !newEnd) {
        return res.status(400).json({ success: false, message: "Missing required fields: newStart, newEnd" });
    }

    try {
        // Fetch the existing event
        const eventResponse = await calendar.events.get({
            calendarId,
            eventId,
        });

        const event = eventResponse.data;

        // Update event start and end times
        event.start = { dateTime: newStart, timeZone: "UTC" };
        event.end = { dateTime: newEnd, timeZone: "UTC" };

        // Send the update request
        const updatedEvent = await calendar.events.update({
            calendarId,
            eventId,
            resource: event,
        });

        res.json({ success: true, message: "Meeting rescheduled successfully!", event: updatedEvent.data });

    } catch (error) {
        console.error("Error rescheduling event:", error);
        res.status(500).json({ success: false, message: "Failed to reschedule event" });
    }
}

export { scheduleMeeting };