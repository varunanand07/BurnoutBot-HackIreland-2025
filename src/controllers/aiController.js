import Groq from "groq-sdk";
import OpenAI from 'openai';
import { getCalendarEvents } from '../api/calendar.js';
import moment from 'moment-timezone';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export const getSortPriority =  async (req, res) => {

  const { input } = req.body;

  const system_prompt = "Rank the JSON meetings based on priority. No extra output, only the meeting names in order of most to least important.";

  

  if (!input) {
    return res.status(400).json({ error: "Missing input" });
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: system_prompt,
        },
        {
          role: "user",
          content: input,
        },
      ],
      model: "llama-3.3-70b-versatile",
    });

    res.json({ response: chatCompletion.choices[0]?.message?.content || "" });
  } catch (error) {
    console.error("Error fetching chat completion:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Meeting Summarizer
export const generateMeetingSummary = async (description, attendees, duration) => {
    try {
        const prompt = `
        Analyze this meeting information and provide:
        1. A concise summary
        2. Key action items (as a bulleted list)
        3. Suggested follow-ups

        Meeting Details:
        Duration: ${duration} minutes
        Attendees: ${attendees.join(', ')}
        Description: ${description}
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are an AI assistant that specializes in analyzing meetings and extracting key information."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7
        });

        return {
            summary: response.choices[0].message.content,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error generating meeting summary:', error);
        throw error;
    }
};

// Smart Meeting Recommendations
export const generateMeetingRecommendations = async (userId, events) => {
    try {
        console.log(`Analyzing ${events.length} events for user ${userId}`);
        
        // Generate optimization suggestions
        const suggestions = {
            timeOptimization: [],
            durationOptimization: [],
            participantOptimization: [],
            formatOptimization: []
        };

        let longMeetingsCount = 0;
        let backToBackCount = 0;
        let smallMeetingsCount = 0;

        // Analyze meetings
        events.forEach((event, index) => {
            const start = moment(event.start.dateTime);
            const end = moment(event.end.dateTime);
            const duration = end.diff(start, 'minutes');
            
            console.log(`Analyzing meeting: ${event.summary}, duration: ${duration} mins, attendees: ${event.attendees?.length || 0}`);

            // Check for back-to-back meetings
            if (index > 0) {
                const prevEnd = moment(events[index - 1].end.dateTime);
                if (start.diff(prevEnd, 'minutes') < 15) {
                    backToBackCount++;
                }
            }

            // Duration analysis
            if (duration > 60) {
                longMeetingsCount++;
                suggestions.durationOptimization.push({
                    meetingId: event.id,
                    title: event.summary,
                    suggestion: `Consider breaking "${event.summary}" (${duration} mins) into shorter sessions`
                });
            }

            // Small meetings analysis
            if (event.attendees?.length <= 2 && duration <= 30) {
                smallMeetingsCount++;
                suggestions.formatOptimization.push({
                    meetingId: event.id,
                    title: event.summary,
                    suggestion: `"${event.summary}" with ${event.attendees.length} attendee(s) might be handled via chat/email`
                });
            }
        });

        // Add time optimization suggestions
        if (backToBackCount > 0) {
            suggestions.timeOptimization.push(`You have ${backToBackCount} back-to-back meetings. Consider adding breaks between them.`);
        }

        // Add duration optimization insights
        if (longMeetingsCount > 0) {
            suggestions.timeOptimization.push(`You have ${longMeetingsCount} meetings longer than 60 minutes. Consider shorter focused sessions.`);
        }

        console.log('Generated suggestions:', suggestions);
        return suggestions;
    } catch (error) {
        console.error('Error generating meeting recommendations:', error);
        throw error;
    }
};

// Calendar Health Score
export const calculateCalendarHealth = async (userId, events) => {
    try {
        const healthMetrics = {
            score: 0,
            breakCompliance: 0,
            focusTimeRatio: 0,
            meetingEfficiency: 0,
            workLifeBalance: 0,
            details: {
                positiveFactors: [],
                negativeFactors: [],
                recommendations: []
            }
        };

        // Calculate break compliance
        const breakCompliance = calculateBreakCompliance(events);
        healthMetrics.breakCompliance = breakCompliance;
        
        // Calculate focus time ratio
        const focusTimeRatio = calculateFocusTimeRatio(events);
        healthMetrics.focusTimeRatio = focusTimeRatio;

        // Calculate meeting efficiency
        const meetingEfficiency = calculateMeetingEfficiency(events);
        healthMetrics.meetingEfficiency = meetingEfficiency;

        // Calculate work-life balance
        const workLifeBalance = calculateWorkLifeBalance(events);
        healthMetrics.workLifeBalance = workLifeBalance;

        // Calculate overall health score (0-100)
        healthMetrics.score = Math.round(
            (breakCompliance * 25) +
            (focusTimeRatio * 25) +
            (meetingEfficiency * 25) +
            (workLifeBalance * 25)
        );

        // Generate recommendations
        healthMetrics.details = generateHealthRecommendations(healthMetrics);

        return healthMetrics;
    } catch (error) {
        console.error('Error calculating calendar health:', error);
        throw error;
    }
};

// Helper functions
function analyzeMeetingPatterns(events) {
    const patterns = {
        backToBack: 0,
        earlyMorning: 0,
        lateEvening: 0,
        longMeetings: 0
    };

    events.forEach((event, index) => {
        const start = moment(event.start.dateTime);
        const end = moment(event.end.dateTime);
        const duration = end.diff(start, 'minutes');

        // Check for back-to-back meetings
        if (index > 0) {
            const previousEnd = moment(events[index - 1].end.dateTime);
            if (start.diff(previousEnd, 'minutes') < 15) {
                patterns.backToBack++;
            }
        }

        // Check timing
        if (start.hour() < 9) patterns.earlyMorning++;
        if (end.hour() >= 17) patterns.lateEvening++;
        if (duration > 60) patterns.longMeetings++;
    });

    return patterns;
}

function calculateBreakCompliance(events) {
    let score = 1;
    let consecutiveMeetings = 0;

    events.forEach((event, index) => {
        if (index > 0) {
            const timeBetween = moment(event.start.dateTime)
                .diff(moment(events[index - 1].end.dateTime), 'minutes');
            
            if (timeBetween < 15) {
                consecutiveMeetings++;
                score -= 0.1 * consecutiveMeetings;
            } else {
                consecutiveMeetings = 0;
            }
        }
    });

    return Math.max(0, score);
}

function calculateFocusTimeRatio(events) {
    const workingHours = 9; // 9 hours workday
    const totalMeetingTime = events.reduce((total, event) => {
        const duration = moment(event.end.dateTime)
            .diff(moment(event.start.dateTime), 'hours', true);
        return total + duration;
    }, 0);

    return Math.max(0, Math.min(1, (workingHours - totalMeetingTime) / workingHours));
}

function calculateMeetingEfficiency(events) {
    let score = 1;

    events.forEach(event => {
        const duration = moment(event.end.dateTime)
            .diff(moment(event.start.dateTime), 'minutes');
        const attendees = event.attendees?.length || 1;

        // Penalize for long meetings with many attendees
        if (duration > 60 && attendees > 5) score -= 0.1;
        // Penalize for very short meetings with many attendees
        if (duration < 15 && attendees > 3) score -= 0.1;
    });

    return Math.max(0, score);
}

function calculateWorkLifeBalance(events) {
    let score = 1;

    events.forEach(event => {
        const start = moment(event.start.dateTime);
        const end = moment(event.end.dateTime);

        // Penalize for early/late meetings
        if (start.hour() < 9) score -= 0.1;
        if (end.hour() >= 17) score -= 0.1;
    });

    return Math.max(0, score);
}

function generateHealthRecommendations(metrics) {
    const details = {
        positiveFactors: [],
        negativeFactors: [],
        recommendations: []
    };

    // Analyze break compliance
    if (metrics.breakCompliance > 0.8) {
        details.positiveFactors.push("Good break scheduling between meetings");
    } else {
        details.negativeFactors.push("Too many back-to-back meetings");
        details.recommendations.push("Try to add 15-minute breaks between meetings");
    }

    // Analyze focus time
    if (metrics.focusTimeRatio > 0.6) {
        details.positiveFactors.push("Healthy amount of focus time");
    } else {
        details.negativeFactors.push("Limited focus time available");
        details.recommendations.push("Block out specific times for focused work");
    }

    // Analyze meeting efficiency
    if (metrics.meetingEfficiency > 0.8) {
        details.positiveFactors.push("Efficient meeting scheduling");
    } else {
        details.negativeFactors.push("Meeting durations could be optimized");
        details.recommendations.push("Consider shorter meetings or reducing participant count");
    }

    // Analyze work-life balance
    if (metrics.workLifeBalance > 0.8) {
        details.positiveFactors.push("Good work-life balance");
    } else {
        details.negativeFactors.push("Meetings outside core hours detected");
        details.recommendations.push("Try to schedule meetings within core working hours");
    }

    return details;
}

