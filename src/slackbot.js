import pkg from '@slack/bolt';
const { App } = pkg;
import { SLACK_CONFIG } from './config.js';
import { handleCalendarCommand } from './commands/calendar.js';
import { handleRescheduleCommand } from './commands/reschedule.js';
import { handleWorkloadCommand } from './commands/workload.js';
import { createCalendarEvent, updateCalendarEvent, getCalendarEvents } from './api/calendar.js';
import { getTokens, getAuthUrl } from './api/auth.js';
import { optimizeMeeting } from './controllers/aiMeetingOptimizer.js';
import { generateMeetingSummary, generateMeetingRecommendations, calculateCalendarHealth } from './controllers/aiController.js';
import { suggestSmartBreaks } from './controllers/breakController.js';
import { calculateMeetingEfficiency } from './controllers/analyticsController.js';
import { findOptimalTeamMeeting, analyzeTeamWorkload, getTeamAvailability } from './controllers/teamController.js';
import { logger, auditLog } from './utils/logger.js';
import moment from 'moment-timezone';
import { hasPermission } from './auth/rbac.js';

const app = new App({
  token: SLACK_CONFIG.token,
  signingSecret: SLACK_CONFIG.signingSecret,
  socketMode: true,
  appToken: SLACK_CONFIG.appToken
});

app.error(async (error) => {
  logger.error('Slack app error:', error);
});

// Middleware to check permissions for team commands
const checkTeamPermission = async ({ command, ack, respond, next }) => {
  await ack();
  
  try {
    const { user_id } = command;
    const hasTeamAccess = await hasPermission(user_id, 'view_team_workload');
    
    if (!hasTeamAccess) {
      await auditLog(user_id, 'UNAUTHORIZED_TEAM_ACCESS', { command: command.command });
      await respond("You don't have permission to access team data. Please contact your administrator.");
      return;
    }
    
    await next();
  } catch (error) {
    logger.error('Error checking team permissions:', error);
    await respond("An error occurred while checking permissions.");
  }
};

// Middleware to check permissions for calendar write operations
const checkCalendarWritePermission = async ({ command, ack, respond, next }) => {
  await ack();
  
  try {
    const { user_id } = command;
    const hasWriteAccess = await hasPermission(user_id, 'modify_team_calendar');
    
    if (!hasWriteAccess) {
      await auditLog(user_id, 'UNAUTHORIZED_CALENDAR_WRITE', { command: command.command });
      await respond("You don't have permission to modify calendar events. Please contact your administrator.");
      return;
    }
    
    await next();
  } catch (error) {
    logger.error('Error checking calendar write permissions:', error);
    await respond("An error occurred while checking permissions.");
  }
};

// Apply middleware to team commands
app.command('/team-workload', checkTeamPermission);
app.command('/team-availability', checkTeamPermission);

// Apply middleware to calendar write commands
app.command('/reschedule', checkCalendarWritePermission);

app.command('/calendar', async ({ command, ack, respond }) => {
  await ack();
  
  try {
    await handleCalendarCommand(command, respond);
    
    // Log the command execution
    await auditLog(command.user_id, 'COMMAND_EXECUTED', { 
      command: '/calendar',
      parameters: command.text
    });
  } catch (error) {
    logger.error('Error handling calendar command:', error);
    
    // Log the error
    await auditLog(command.user_id, 'COMMAND_ERROR', { 
      command: '/calendar',
      error: error.message
    });
    
    await respond("Sorry, there was an error with the calendar command.");
  }
});

app.command('/reschedule', async ({ command, ack, respond }) => {
  await ack();
  
  try {
    await handleRescheduleCommand(command, respond);
    
    // Log the command execution
    await auditLog(command.user_id, 'COMMAND_EXECUTED', { 
      command: '/reschedule'
    });
  } catch (error) {
    logger.error('Error handling reschedule command:', error);
    
    // Log the error
    await auditLog(command.user_id, 'COMMAND_ERROR', { 
      command: '/reschedule',
      error: error.message
    });
    
    await respond("Sorry, there was an error with the reschedule command.");
  }
});

app.command('/workload', async ({ command, ack, respond }) => {
  await ack();
  
  try {
    await handleWorkloadCommand(command, respond);
    
    // Log the command execution
    await auditLog(command.user_id, 'COMMAND_EXECUTED', { 
      command: '/workload',
      parameters: command.text
    });
  } catch (error) {
    logger.error('Error handling workload command:', error);
    
    // Log the error
    await auditLog(command.user_id, 'COMMAND_ERROR', { 
      command: '/workload',
      error: error.message
    });
    
    await respond("Sorry, there was an error with the workload command.");
  }
});

app.command('/team-workload', async ({ command, respond }) => {
  try {
    const { user_id, text } = command;
    const tokens = await getTokens(user_id);

    if (!tokens) {
      await respond("Please authenticate first!");
      return;
    }

    // Log the command execution
    await auditLog(user_id, 'COMMAND_EXECUTED', { 
      command: '/team-workload',
      parameters: text
    });

    // Get current date and end of week
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 7);

    // Fetch events
    const events = await getCalendarEvents(
      tokens.access_token, 
      timeMin.toISOString(), 
      timeMax.toISOString()
    );

    // Default to the requesting user if no team members specified
    const teamMembers = text ? 
      text.split(' ').map(email => ({ email })) : 
      [{ email: command.user_email }];

    // Analyze team workload
    const analysis = await analyzeTeamWorkload(teamMembers, events);

    // Respond with analysis
    await respond({
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📊 Team Workload Analysis"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Team Overview*\n• Total Team Meetings: ${analysis.totalMeetings}\n• Total Meeting Hours: ${analysis.totalHours.toFixed(1)}\n• Average Meetings Per Person: ${analysis.avgMeetingsPerPerson.toFixed(1)}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Team Burnout Risk*\n${analysis.teamBurnoutRisk}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Individual Workloads*\n${analysis.memberWorkloads.map(member => 
              `• ${member.email}: ${member.meetings} meetings (${member.hours.toFixed(1)} hours)`
            ).join('\n')}`
          }
        }
      ]
    });

    // Log successful response
    await auditLog(user_id, 'COMMAND_COMPLETED', { 
      command: '/team-workload',
      result: 'success'
    });
  } catch (error) {
    logger.error('Error handling team workload command:', error);
    
    // Log the error
    await auditLog(user_id, 'COMMAND_ERROR', { 
      command: '/team-workload',
      error: error.message
    });
    
    await respond("Sorry, there was an error analyzing team workload.");
  }
});

app.command('/team-availability', async ({ command, ack, respond }) => {
  await ack();
  
  try {
    const { user_id, text } = command;
    
    // Log the command execution
    await auditLog(user_id, 'COMMAND_EXECUTED', { 
      command: '/team-availability',
      parameters: text
    });
    
    const tokens = await getTokens(user_id);

    if (!tokens) {
      await respond("Please authenticate first!");
      return;
    }

    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 5); // Look ahead 5 days

    const events = await getCalendarEvents(tokens.access_token, timeMin.toISOString(), timeMax.toISOString());
    
    // Get team members from command text
    const teamMembers = text ? 
        text.split(' ').map(email => ({ email })) : 
        [{ email: command.user_email }];

    const optimalSlots = await findOptimalTeamMeeting(teamMembers, events);

    await respond({
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "📅 Team Availability"
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: optimalSlots.suggestions.length > 0 ? 
                        "*Best Meeting Times*\n" + optimalSlots.suggestions.map((slot, index) => 
                            `${index + 1}. ${slot.date} at ${moment(slot.start).format('h:mm A')} - ${moment(slot.end).format('h:mm A')}\n   _Score: ${(slot.score * 100).toFixed(0)}% optimal_`
                        ).join('\n') :
                        "No suitable meeting times found in the next 5 working days."
                }
            }
        ]
    });
    
    // Log successful response
    await auditLog(user_id, 'COMMAND_COMPLETED', { 
      command: '/team-availability',
      result: 'success'
    });
  } catch (error) {
    logger.error('Error handling team availability command:', error);
    
    // Log the error
    await auditLog(user_id, 'COMMAND_ERROR', { 
      command: '/team-availability',
      error: error.message
    });
    
    await respond("Sorry, there was an error finding team availability.");
  }
});

app.command('/calendar-health', async ({ command, ack, respond }) => {
  await ack();
  
  try {
    const { user_id } = command;
    
    // Log the command execution
    await auditLog(user_id, 'COMMAND_EXECUTED', { 
      command: '/calendar-health'
    });
    
    const tokens = await getTokens(user_id);

    if (!tokens) {
      await respond("Please authenticate first!");
      return;
    }

    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 14); // Look ahead 2 weeks

    const events = await getCalendarEvents(tokens.access_token, timeMin.toISOString(), timeMax.toISOString());
    const healthReport = await calculateCalendarHealth(events);

    await respond({
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📊 Calendar Health Report"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Overall Health Score: ${healthReport.overallScore}/100*\n${healthReport.summary}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Key Metrics*\n" +
                  `• Back-to-back Meetings: ${healthReport.metrics.backToBackCount}\n` +
                  `• Meetings Outside Work Hours: ${healthReport.metrics.outsideHoursCount}\n` +
                  `• Average Meeting Duration: ${healthReport.metrics.avgDuration} minutes\n` +
                  `• Focus Time Blocks: ${healthReport.metrics.focusTimeBlocks}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Recommendations*\n" + healthReport.recommendations.join('\n')
          }
        }
      ]
    });
    
    // Log successful response
    await auditLog(user_id, 'COMMAND_COMPLETED', { 
      command: '/calendar-health',
      result: 'success',
      healthScore: healthReport.overallScore
    });
  } catch (error) {
    logger.error('Error handling calendar health command:', error);
    
    // Log the error
    await auditLog(user_id, 'COMMAND_ERROR', { 
      command: '/calendar-health',
      error: error.message
    });
    
    await respond("Sorry, there was an error analyzing your calendar health.");
  }
});

app.command('/optimize-meetings', async ({ command, ack, respond }) => {
  await ack();
  
  try {
    const { user_id, text } = command;
    
    // Log the command execution
    await auditLog(user_id, 'COMMAND_EXECUTED', { 
      command: '/optimize-meetings',
      parameters: text
    });
    
    const tokens = await getTokens(user_id);

    if (!tokens) {
      await respond("Please authenticate first!");
      return;
    }

    const timeMin = new Date();
    const timeMax = new Date();
    
    // Determine timeframe from command text
    let timeframe = "Today";
    if (text.includes('week')) {
      timeMax.setDate(timeMax.getDate() + 7);
      timeframe = "Weekly";
    } else if (text.includes('month')) {
      timeMax.setMonth(timeMax.getMonth() + 1);
      timeframe = "Monthly";
    } else {
      timeMax.setHours(23, 59, 59);
    }

    const events = await getCalendarEvents(tokens.access_token, timeMin.toISOString(), timeMax.toISOString());
    const recommendations = await generateMeetingRecommendations(events, timeframe);

    await respond({
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🔍 Meeting Optimization (${timeframe})`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Schedule Optimization*"
          }
        },
        ...recommendations.scheduleOptimization.map(rec => ({
          type: "section",
          text: {
            type: "mrkdwn",
            text: rec
          }
        })),
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Duration Optimization*"
          }
        },
        ...recommendations.durationOptimization.map(rec => ({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${rec.title}*\n${rec.suggestion}`
          }
        }))
      ]
    });
    
    // Log successful response
    await auditLog(user_id, 'COMMAND_COMPLETED', { 
      command: '/optimize-meetings',
      result: 'success',
      timeframe
    });
  } catch (error) {
    logger.error('Error handling optimize meetings command:', error);
    
    // Log the error
    await auditLog(user_id, 'COMMAND_ERROR', { 
      command: '/optimize-meetings',
      error: error.message
    });
    
    await respond("Sorry, there was an error optimizing your meetings.");
  }
});

app.action('schedule_break', async ({ body, ack, respond }) => {
  await ack();
  
  try {
    const userId = body.user.id;
    
    // Log the action
    await auditLog(userId, 'ACTION_TRIGGERED', { 
      action: 'schedule_break'
    });
    
    const tokens = await getTokens(userId);
    
    if (!tokens) {
      await respond("Please authenticate first!");
      return;
    }
    
    // Get current date
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59);
    
    // Get events for today
    const events = await getCalendarEvents(tokens.access_token, now.toISOString(), endOfDay.toISOString());
    
    // Suggest breaks
    const breakSuggestions = await suggestSmartBreaks(events);
    
    if (breakSuggestions.length === 0) {
      await respond("No suitable break times found for today.");
      return;
    }
    
    // Format break suggestions
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🧘 Suggested Break Times"
        }
      }
    ];
    
    breakSuggestions.forEach((breakSlot, index) => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Option ${index + 1}*: ${moment(breakSlot.start).format('h:mm A')} - ${moment(breakSlot.end).format('h:mm A')}\n${breakSlot.type === 'recovery' ? '🔋 Recovery break after intense meetings' : '⏱️ Gap between meetings'}`
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Schedule"
          },
          value: JSON.stringify({
            start: breakSlot.start,
            end: breakSlot.end
          }),
          action_id: `schedule_break_${index}`
        }
      });
      
      // Add action handler for this specific break option
      app.action(`schedule_break_${index}`, async ({ body, ack, respond }) => {
        await ack();
        
        try {
          const userId = body.user.id;
          const breakDetails = JSON.parse(body.actions[0].value);
          
          // Log the action
          await auditLog(userId, 'ACTION_TRIGGERED', { 
            action: `schedule_break_${index}`,
            breakDetails
          });
          
          const tokens = await getTokens(userId);
          
          if (!tokens) {
            await respond("Please authenticate first!");
            return;
          }
          
          // Create calendar event for the break
          const breakEvent = {
            summary: 'Scheduled Break',
            description: 'Break time scheduled via BurnoutBot',
            start: {
              dateTime: new Date(breakDetails.start).toISOString()
            },
            end: {
              dateTime: new Date(breakDetails.end).toISOString()
            },
            colorId: '9' // Blue color
          };
          
          await createCalendarEvent(tokens.access_token, breakEvent);
          
          await respond(`Break scheduled from ${moment(breakDetails.start).format('h:mm A')} to ${moment(breakDetails.end).format('h:mm A')}! 🎉`);
          
          // Log successful break scheduling
          await auditLog(userId, 'BREAK_SCHEDULED', { 
            start: breakDetails.start,
            end: breakDetails.end
          });
        } catch (error) {
          logger.error('Error scheduling break:', error);
          
          // Log the error
          await auditLog(userId, 'BREAK_SCHEDULING_ERROR', { 
            error: error.message
          });
          
          await respond("Sorry, there was an error scheduling your break.");
        }
      });
    });
    
    await respond({ blocks });
  } catch (error) {
    logger.error('Error suggesting breaks:', error);
    
    // Log the error
    await auditLog(body.user.id, 'ACTION_ERROR', { 
      action: 'schedule_break',
      error: error.message
    });
    
    await respond("Sorry, there was an error suggesting break times.");
  }
});

export default app;