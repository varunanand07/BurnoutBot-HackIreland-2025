/**
 * Burnout Calculation Logic
 * - Measures meeting overload
 * - Detects back-to-back meetings
 * - Considers after-hours & weekend meetings
 * - Assigns a burnout risk score
 */

const calculateBurnoutScore = (meetings) => {
    let totalMeetingHours = 0;
    let backToBackCount = 0;
    let afterHoursMeetings = 0;
    let weekendMeetings = 0;
    let longestStreak = 0;
    let prevEndTime = null;
    let streak = 0;

    // Loop through all meetings
    meetings.forEach((meeting) => {
        let startTime = new Date(meeting.startTime);
        let endTime = new Date(meeting.endTime);
        let duration = (endTime - startTime) / (1000 * 60 * 60); // Convert milliseconds to hours

        totalMeetingHours += duration;

        // Check for back-to-back meetings (less than 15 min break)
        if (prevEndTime && (startTime - prevEndTime) <= 15 * 60 * 1000) {
            streak += duration;
            longestStreak = Math.max(longestStreak, streak);
            backToBackCount++;
        } else {
            streak = duration;
        }

        prevEndTime = endTime;

        // Detect after-hours meetings (before 9 AM or after 6 PM)
        let startHour = startTime.getHours();
        if (startHour < 9 || startHour > 18) {
            afterHoursMeetings++;
        }

        // Detect weekend meetings
        let meetingDay = startTime.getDay(); // 0 = Sunday, 6 = Saturday
        if (meetingDay === 0 || meetingDay === 6) {
            weekendMeetings++;
        }
    });

    // Calculate burnout score based on different factors
    let burnoutScore =
        (totalMeetingHours / 8) * 30 + // Higher meeting load increases burnout
        backToBackCount * 20 + // More back-to-back meetings increase burnout
        afterHoursMeetings * 15 + // Working late adds to burnout
        weekendMeetings * 15 + // Weekend meetings contribute to burnout
        (longestStreak > 4 ? 20 : 0); // Longest continuous meeting streak adds stress

    return {
        totalMeetingHours,
        backToBackCount,
        afterHoursMeetings,
        weekendMeetings,
        longestStreak,
        burnoutScore,
    };
};

/**
 * API Endpoint: Analyze an employee's burnout risk
 */
const analyzeBurnout = (req, res) => {
    try {
        const { meetings } = req.body;

        if (!meetings || meetings.length === 0) {
            return res.status(400).json({ error: "No meetings data provided" });
        }

        const burnoutResult = calculateBurnoutScore(meetings);
        res.json(burnoutResult);
    } catch (error) {
        console.error("Error analyzing burnout:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export { analyzeBurnout, calculateBurnoutScore };