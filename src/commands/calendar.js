import { getCalendarEvents } from '../api/calendar.js';
import { getTokens, getAuthUrl } from '../api/auth.js';

export const handleCalendarCommand = async (command, respond) => {
  try {
    const { text, user_id } = command;
    console.log('Handling calendar command for user:', user_id);
    
    const tokens = await getTokens(user_id);
    console.log('Retrieved tokens in calendar command:', tokens);
    
    if (!tokens || !tokens.access_token) {
      console.log('No tokens found, requesting authentication');
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

    console.log('Fetching calendar events...');
    let timeMin = new Date();
    let timeMax = new Date();
    timeMax.setHours(23, 59, 59);

    if (text.includes('week')) {
      timeMax.setDate(timeMax.getDate() + 7);
    } else if (text.includes('month')) {
      timeMax.setMonth(timeMax.getMonth() + 1);
    }

    const events = await getCalendarEvents(tokens.access_token, timeMin.toISOString(), timeMax.toISOString());
    console.log('Retrieved events:', events);

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `📅 Calendar Events ${text || 'Today'}`
        }
      }
    ];

    if (!events || events.length === 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "No events scheduled! 🎉"
        }
      });
    } else {
      events.forEach(event => {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${event.summary}*\n${new Date(event.start.dateTime).toLocaleTimeString()} - ${new Date(event.end.dateTime).toLocaleTimeString()}`
          }
        });
      });
    }

    await respond({ blocks });
  } catch (error) {
    console.error('Error in handleCalendarCommand:', error);
    await respond({
      text: "Sorry, there was an error fetching your calendar events. Please try again."
    });
  }
};