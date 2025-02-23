import { getCalendarEvents, updateCalendarEvent } from '../api/calendar.js';
import { getTokens, getAuthUrl } from '../api/auth.js';

export const handleRescheduleCommand = async (command, respond) => {
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
    timeMax.setHours(23, 59, 59);

    const events = await getCalendarEvents(tokens.access_token, timeMin.toISOString(), timeMax.toISOString());

    if (!events || events.length === 0) {
      return await respond({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "No meetings scheduled for today! 🎉"
            }
          }
        ]
      });
    }

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Which meeting would you like to reschedule?"
        }
      }
    ];

    events.forEach(event => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${event.summary}*\n${new Date(event.start.dateTime).toLocaleTimeString()} - ${new Date(event.end.dateTime).toLocaleTimeString()}`
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Reschedule"
          },
          value: event.id,
          action_id: `reschedule_meeting_${event.id}`
        }
      });
    });

    await respond({ blocks });
  } catch (error) {
    console.error('Error handling reschedule command:', error);
    await respond({
      text: "Sorry, there was an error with the reschedule command. Please try again."
    });
  }
};