import pkg from '@slack/bolt';
const { App } = pkg;
import { SLACK_CONFIG } from './config.js';
import { handleCalendarCommand } from './commands/calendar.js';
import { handleRescheduleCommand } from './commands/reschedule.js';
import { handleWorkloadCommand } from './commands/workload.js';
import { createCalendarEvent, updateCalendarEvent } from './api/calendar.js';
import { getTokens } from './api/auth.js';

const app = new App({
  token: SLACK_CONFIG.token,
  signingSecret: SLACK_CONFIG.signingSecret,
  socketMode: true,
  appToken: SLACK_CONFIG.appToken
});

app.error(async (error) => {
  console.error('Slack app error:', error);
});

app.command('/calendar', async ({ command, ack, respond }) => {
  try {
    await ack();
    console.log('Received calendar command:', command);
    await handleCalendarCommand(command, respond);
  } catch (error) {
    console.error('Error handling calendar command:', error);
    await respond('Sorry, there was an error processing your command.');
  }
});

app.command('/reschedule', async ({ command, ack, respond }) => {
  try {
    await ack();
    await handleRescheduleCommand(command, respond);
  } catch (error) {
    console.error('Error handling reschedule command:', error);
    await respond('Sorry, there was an error processing your command.');
  }
});

app.command('/workload', async ({ command, ack, respond }) => {
  try {
    await ack();
    await handleWorkloadCommand(command, respond);
  } catch (error) {
    console.error('Error handling workload command:', error);
    await respond('Sorry, there was an error processing your command.');
  }
});

app.action(/reschedule_meeting_.*/, async ({ ack, body, respond }) => {
  await ack();
  const eventId = body.actions[0].value;
  
  await respond({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "When would you like to reschedule this meeting to?"
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "datepicker",
            placeholder: {
              type: "plain_text",
              text: "Select a date"
            },
            action_id: "reschedule_date"
          },
          {
            type: "timepicker",
            placeholder: {
              type: "plain_text",
              text: "Select time"
            },
            action_id: "reschedule_time"
          }
        ]
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Apply Changes",
              emoji: true
            },
            style: "primary",
            value: eventId,
            action_id: "reschedule_submit"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Cancel",
              emoji: true
            },
            style: "danger",
            value: eventId,
            action_id: "reschedule_cancel"
          }
        ]
      }
    ]
  });
});

const rescheduleState = new Map();

app.action('reschedule_date', async ({ ack, body, respond }) => {
  await ack();
  console.log('Date picker action payload:', body);
  const selectedDate = body.actions[0].selected_date;
  console.log('Selected date:', selectedDate);
  rescheduleState.set(`${body.user.id}_date`, selectedDate);
  
  // Verify storage
  const storedDate = rescheduleState.get(`${body.user.id}_date`);
  console.log('Stored date after setting:', storedDate);
});

app.action('reschedule_time', async ({ ack, body }) => {
  await ack();
  console.log('Time picker action payload:', body);
  const selectedTime = body.actions[0].selected_time;
  console.log('Selected time:', selectedTime);
  rescheduleState.set(`${body.user.id}_time`, selectedTime);
  
  // Verify storage
  const storedTime = rescheduleState.get(`${body.user.id}_time`);
  console.log('Stored time after setting:', storedTime);
});

app.action('reschedule_submit', async ({ ack, body, respond }) => {
  try {
    await ack();
    const userId = body.user.id;
    const eventId = body.actions[0].value;
    
    // Debug logging
    console.log('Submit action - User ID:', userId);
    console.log('Submit action - Event ID:', eventId);
    console.log('All stored state:', Object.fromEntries(rescheduleState));
    console.log('Stored date:', rescheduleState.get(`${userId}_date`));
    console.log('Stored time:', rescheduleState.get(`${userId}_time`));
    
    const selectedDate = rescheduleState.get(`${userId}_date`);
    const selectedTime = rescheduleState.get(`${userId}_time`);

    if (!selectedDate || !selectedTime) {
      console.log('Missing date or time - Date:', selectedDate, 'Time:', selectedTime);
      await respond({
        text: "Please select both date and time before applying changes.",
        replace_original: false
      });
      return;
    }

    const tokens = await getTokens(userId);
    if (!tokens) {
      await respond("Please authenticate first!");
      return;
    }

    const newStartTime = new Date(`${selectedDate}T${selectedTime}`);
    const newEndTime = new Date(newStartTime);
    newEndTime.setHours(newEndTime.getHours() + 1);

    await updateCalendarEvent(tokens.access_token, eventId, {
      start: {
        dateTime: newStartTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: newEndTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });

    rescheduleState.delete(`${userId}_date`);
    rescheduleState.delete(`${userId}_time`);

    await respond({
      text: "✅ Meeting rescheduled successfully!",
      replace_original: true
    });
  } catch (error) {
    console.error('Error in reschedule_submit:', error);
    await respond({
      text: "❌ Sorry, there was an error rescheduling your meeting.",
      replace_original: false
    });
  }
});

app.action('reschedule_cancel', async ({ ack, respond }) => {
  await ack();
  await respond({
    text: "Rescheduling cancelled.",
    replace_original: true
  });
});

app.action('schedule_break', async ({ ack, body, respond }) => {
  try {
    await ack();
    const tokens = await getTokens(body.user.id);
    
    if (!tokens) {
      await respond("Please authenticate first!");
      return;
    }

    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() + 30);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30);

    const breakEvent = {
      summary: '🧘‍♂️ Scheduled Break',
      description: 'Taking a break to prevent burnout',
      start: {
        dateTime: startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    await createCalendarEvent(tokens.access_token, breakEvent);
    await respond("Break scheduled successfully! 🎉");
  } catch (error) {
    console.error('Error scheduling break:', error);
    await respond("Sorry, there was an error scheduling your break.");
  }
});

export default app;