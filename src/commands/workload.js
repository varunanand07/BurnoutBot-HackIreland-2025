import { getCalendarEvents } from '../api/calendar.js';
import { getTokens, getAuthUrl } from '../api/auth.js';

export const handleWorkloadCommand = async (command, respond) => {
  try {
    const { user_id } = command;
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
    timeMax.setDate(timeMax.getDate() + 7);

    const events = await getCalendarEvents(tokens.access_token, timeMin.toISOString(), timeMax.toISOString());

    const analysis = analyzeWorkload(events);

    await respond({
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📊 Workload Analysis"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Weekly Overview*\n• Total Meetings: ${analysis.totalMeetings}\n• Total Hours: ${analysis.totalHours.toFixed(1)}\n• Busiest Day: ${analysis.busiestDay}\n• Average Daily Meetings: ${analysis.avgDailyMeetings.toFixed(1)}`
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

function analyzeWorkload(events) {
  const analysis = {
    totalMeetings: events.length,
    totalHours: 0,
    busiestDay: 'None',
    avgDailyMeetings: 0,
    burnoutRisk: ''
  };

  const dailyMeetings = {};

  events.forEach(event => {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    const duration = (end - start) / (1000 * 60 * 60);
    
    const dayKey = start.toLocaleDateString();
    dailyMeetings[dayKey] = (dailyMeetings[dayKey] || 0) + 1;
    analysis.totalHours += duration;
  });

  let maxMeetings = 0;
  Object.entries(dailyMeetings).forEach(([day, count]) => {
    if (count > maxMeetings) {
      maxMeetings = count;
      analysis.busiestDay = new Date(day).toLocaleDateString('en-US', { weekday: 'long' });
    }
  });

  analysis.avgDailyMeetings = analysis.totalMeetings / Object.keys(dailyMeetings).length;

  if (analysis.totalHours > 30) {
    analysis.burnoutRisk = "⚠️ High risk of burnout. Consider rescheduling some meetings or taking breaks.";
  } else if (analysis.totalHours > 20) {
    analysis.burnoutRisk = "⚠️ Moderate risk of burnout. Try to schedule some breaks between meetings.";
  } else {
    analysis.burnoutRisk = "✅ Low risk of burnout. Your schedule looks manageable.";
  }

  return analysis;
}