import { getCalendarEvents } from '../api/calendar.js';
import { getTokens, getAuthUrl } from '../api/auth.js';

export const handleWorkloadCommand = async (command, respond) => {
  try {
    const { text, user_id } = command;
    const tokens = await getTokens(user_id);

    if (!tokens || !tokens.access_token) {
      const authUrl = getAuthUrl(user_id);
      return await respond({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Please authenticate with Google Calendar first! Click the button below:"
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Connect Google Calendar"
                },
                url: authUrl,
                action_id: "connect_calendar"
              }
            ]
          }
        ]
      });
    }

    const timeMin = new Date();
    const timeMax = new Date();

    // Set time range based on command
    if (text.includes('month')) {
      timeMax.setMonth(timeMax.getMonth() + 1);
    } else if (text.includes('week')) {
      timeMax.setDate(timeMax.getDate() + 7);
    } else {
      // Default to daily
      timeMax.setHours(23, 59, 59);
    }

    const events = await getCalendarEvents(tokens.access_token, timeMin.toISOString(), timeMax.toISOString());
    const analysis = analyzeWorkload(events, text);

    await respond({
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `📊 Workload Analysis (${text || 'Today'})`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Daily'} Overview*\n• Total Meetings: ${analysis.totalMeetings}\n• Total Hours: ${analysis.totalHours.toFixed(1)}\n• Busiest ${analysis.timeUnit}: ${analysis.busiestDay}\n• Average Meetings per ${analysis.timeUnit}: ${analysis.avgMeetings.toFixed(1)}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Burnout Risk*\n${analysis.burnoutRisk}`
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Schedule a Break"
              },
              action_id: "schedule_break"
            }
          ]
        }
      ]
    });
  } catch (error) {
    console.error('Error handling workload command:', error);
    await respond({
      text: "Sorry, there was an error analyzing your workload. Please try again."
    });
  }
};

function analyzeWorkload(events, timeframe) {
  const analysis = {
    totalMeetings: events.length,
    totalHours: 0,
    busiestDay: 'None',
    avgMeetings: 0,
    burnoutRisk: '',
    timeUnit: timeframe?.includes('month') ? 'Day' : timeframe?.includes('week') ? 'Day' : 'Hour',
    breakCount: 0,
    suggestedBreaks: 0
  };

  // Find breaks (gaps between meetings of 30+ minutes)
  let lastEventEnd = null;
  events.sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime))
    .forEach(event => {
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);
      
      if (lastEventEnd) {
        const gap = (start - lastEventEnd) / (1000 * 60); // gap in minutes
        if (gap >= 30) {
          analysis.breakCount++;
        }
      }
      lastEventEnd = end;
    });

  // Calculate suggested breaks based on meeting load
  analysis.suggestedBreaks = Math.ceil(events.length / 3); // Suggest a break every 3 meetings

  const timeSlots = {};
  
  events.forEach(event => {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    const duration = (end - start) / (1000 * 60 * 60);
    
    let timeKey;
    if (timeframe?.includes('month')) {
      timeKey = start.toLocaleDateString();
    } else if (timeframe?.includes('week')) {
      timeKey = start.toLocaleDateString();
    } else {
      timeKey = start.getHours();
    }
    
    timeSlots[timeKey] = (timeSlots[timeKey] || 0) + (timeframe?.includes('month') || timeframe?.includes('week') ? 1 : duration);
    analysis.totalHours += duration;
  });

  let maxValue = 0;
  Object.entries(timeSlots).forEach(([slot, value]) => {
    if (value > maxValue) {
      maxValue = value;
      analysis.busiestDay = timeframe?.includes('month') || timeframe?.includes('week') 
        ? new Date(slot).toLocaleDateString('en-US', { weekday: 'long' })
        : `${slot}:00 - ${parseInt(slot) + 1}:00`;
    }
  });

  // Calculate average meetings based on timeframe
  const numSlots = timeframe?.includes('month') ? 30 
    : timeframe?.includes('week') ? 7 
    : 24;
  analysis.avgMeetings = analysis.totalMeetings / numSlots;

  // Set burnout risk thresholds based on timeframe
  if (timeframe?.includes('month')) {
    if (analysis.totalHours > 120) {
      analysis.burnoutRisk = "⚠️ High risk of burnout. Consider reducing monthly meeting load.";
    } else if (analysis.totalHours > 80) {
      analysis.burnoutRisk = "⚠️ Moderate risk of burnout. Try to spread meetings more evenly.";
    } else {
      analysis.burnoutRisk = "✅ Low risk of burnout. Your monthly schedule looks manageable.";
    }
  } else if (timeframe?.includes('week')) {
    if (analysis.totalHours > 30) {
      analysis.burnoutRisk = "⚠️ High risk of burnout. Consider rescheduling some meetings.";
    } else if (analysis.totalHours > 20) {
      analysis.burnoutRisk = "⚠️ Moderate risk of burnout. Try to schedule some breaks.";
    } else {
      analysis.burnoutRisk = "✅ Low risk of burnout. Your weekly schedule looks manageable.";
    }
  } else {
    if (analysis.totalHours > 6) {
      analysis.burnoutRisk = "⚠️ High risk of burnout. Too many meetings today.";
    } else if (analysis.totalHours > 4) {
      analysis.burnoutRisk = "⚠️ Moderate risk of burnout. Consider taking breaks.";
    } else {
      analysis.burnoutRisk = "✅ Low risk of burnout. Your daily schedule looks good.";
    }
  }

  // Modify burnout risk calculation to consider breaks
  const breakDeficit = analysis.suggestedBreaks - analysis.breakCount;
  if (breakDeficit > 0) {
    analysis.burnoutRisk = analysis.burnoutRisk.replace("✅", "⚠️");
    analysis.burnoutRisk += `\n• Need ${breakDeficit} more break${breakDeficit > 1 ? 's' : ''}`;
  }

  return analysis;
}