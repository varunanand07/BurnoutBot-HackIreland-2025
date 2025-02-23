import { getUserEvents } from "../controllers/calendarController.js";
import { calculateBurnoutScore } from "../controllers/burnoutController.js";

const WORK_HOURS = { start: 9, end: 18 }; 
const MIN_BREAK_TIME = 15;
const MAX_MEETING_HOURS = 6;

const findOptimalMeetingSlot = async (participants, duration) => {
    let busyIntervals = [];
    let burnoutScores = {};

    // Step 1: Fetch meetings & burnout scores
    for (let participant of participants) {
        const meetings = await getUserEvents(participant);
        const burnout = calculateBurnoutScore(meetings);
        burnoutScores[participant] = burnout.burnoutScore;

        meetings.forEach((meeting) => {
            busyIntervals.push({
                start: new Date(meeting.startTime),
                end: new Date(meeting.endTime),
            });
        });
    }

    // Step 2: Merge all busy times & sort them
    busyIntervals.sort((a, b) => a.start - b.start);

    // Step 3: Find available time slots
    let availableSlots = [];
    let currentTime = new Date().setHours(WORK_HOURS.start, 0, 0, 0);
    let workEndTime = new Date().setHours(WORK_HOURS.end, 0, 0, 0);

    for (let i = 0; i < busyIntervals.length; i++) {
        let busyStart = busyIntervals[i].start.getTime();

        // Ensure there's enough space for the meeting + a break
        if (busyStart - currentTime >= (duration + MIN_BREAK_TIME) * 60 * 1000) {
            availableSlots.push({
                startTime: new Date(currentTime).toISOString(),
                endTime: new Date(currentTime + duration * 60000).toISOString(),
            });
        }

        // Move current time to the end of this busy slot
        currentTime = Math.max(currentTime, busyIntervals[i].end.getTime());
    }

    // Final check: If time left in the day, add the last possible slot
    if (workEndTime - currentTime >= (duration + MIN_BREAK_TIME) * 60 * 1000) {
        availableSlots.push({
            startTime: new Date(currentTime).toISOString(),
            endTime: new Date(currentTime + duration * 60000).toISOString(),
        });
    }

    // Step 4: Filter slots based on burnout scores
    availableSlots = availableSlots.filter(() => {
        return participants.every((p) => burnoutScores[p] < 60);
    });

    return availableSlots.length > 0 ? availableSlots : "No suitable slots found.";
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

export { scheduleMeeting };