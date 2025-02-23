import OpenAI from 'openai';
import { getCalendarEvents } from '../api/calendar.js';
import { calculateBurnoutScore } from './burnoutController.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export const optimizeMeeting = async (meetingDetails) => {
    const { duration, attendees, purpose, priority } = meetingDetails;
    
    // Get attendees' schedules and burnout scores
    const attendeeMetrics = await Promise.all(attendees.map(async (attendee) => {
        const events = await getCalendarEvents(attendee.token);
        const burnout = calculateBurnoutScore(events);
        return {
            id: attendee.id,
            burnoutScore: burnout.burnoutScore,
            meetingLoad: events.length
        };
    }));

    // Generate AI recommendations
    const prompt = `
    Analyze this meeting request and provide optimization recommendations:
    - Meeting Duration: ${duration} minutes
    - Number of Attendees: ${attendees.length}
    - Purpose: ${purpose}
    - Priority: ${priority}
    - Attendee Metrics: ${JSON.stringify(attendeeMetrics)}

    Consider:
    1. Optimal duration
    2. Whether this could be an async update
    3. If all attendees are necessary
    4. Best time of day based on burnout scores
    5. Format suggestions (in-person/virtual)
    `;

    const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500
    });

    return {
        recommendations: response.choices[0].message.content,
        metrics: attendeeMetrics,
        suggestedChanges: analyzeSuggestions(response.choices[0].message.content)
    };
}; 