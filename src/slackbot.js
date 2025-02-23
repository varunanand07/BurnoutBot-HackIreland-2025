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
import moment from 'moment-timezone';

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
// Team Workload Command
app.command('/team-workload', async ({ command, ack, respond }) => {
    try {
        await ack();
        const { user_id, text } = command;
        const tokens = await getTokens(user_id);

        if (!tokens) {
            await respond("Please authenticate first!");
            return;
        }

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
            text.split(' ').map(email => ({ 
                email,
                events: events.filter(event => 
                    event.attendees?.some(attendee => 
                        attendee.email === email
                    )
                )
            })) : 
            [{
                email: command.user_email || 'you',
                events: events
            }];

        // Analyze workload for each team member
        const analysis = {
            totalMeetings: 0,
            totalMeetingHours: 0,
            memberWorkloads: {},
            recommendations: []
        };

        // Calculate metrics for each team member
        teamMembers.forEach(member => {
            const memberMetrics = {
                meetingCount: member.events.length,
                totalHours: 0,
                backToBackMeetings: 0
            };

            // Calculate total hours and back-to-back meetings
            member.events.forEach((event, index) => {
                const start = moment(event.start.dateTime);
                const end = moment(event.end.dateTime);
                memberMetrics.totalHours += end.diff(start, 'hours', true);

                // Check for back-to-back meetings
                if (index > 0) {
                    const prevEnd = moment(member.events[index - 1].end.dateTime);
                    if (start.diff(prevEnd, 'minutes') < 15) {
                        memberMetrics.backToBackMeetings++;
                    }
                }
            });

            analysis.memberWorkloads[member.email] = memberMetrics;
            analysis.totalMeetings += memberMetrics.meetingCount;
            analysis.totalMeetingHours += memberMetrics.totalHours;
        });

        // Calculate average meetings per person
        analysis.averageMeetingsPerPerson = analysis.totalMeetings / teamMembers.length;

        // Generate recommendations
        if (analysis.averageMeetingsPerPerson > 8) {
            analysis.recommendations.push({
                priority: 'high',
                message: 'High meeting load detected. Consider implementing no-meeting blocks.'
            });
        }

        if (Object.values(analysis.memberWorkloads).some(m => m.backToBackMeetings > 3)) {
            analysis.recommendations.push({
                priority: 'high',
                message: 'Multiple back-to-back meetings detected. Try adding breaks between meetings.'
            });
        }

        await respond({
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "👥 Team Workload Analysis"
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Team Overview (Next 7 Days)*\n• Total Team Meetings: ${analysis.totalMeetings}\n• Average Meetings Per Person: ${analysis.averageMeetingsPerPerson.toFixed(1)}\n• Total Meeting Hours: ${analysis.totalMeetingHours.toFixed(1)}`
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: "*Individual Workloads*\n" + 
                            Object.entries(analysis.memberWorkloads)
                                .map(([email, metrics]) => 
                                    `• ${email}:\n  - Meetings: ${metrics.meetingCount}\n  - Hours: ${metrics.totalHours.toFixed(1)}\n  - Back-to-back: ${metrics.backToBackMeetings}`)
                                .join('\n')
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: "*Recommendations*\n" + 
                            (analysis.recommendations.length > 0 ?
                                analysis.recommendations
                                    .map(rec => `• ${rec.priority === 'high' ? '🔴' : '🟡'} ${rec.message}`)
                                    .join('\n') :
                                "✅ No immediate concerns detected in the team's workload.")
                    }
                }
            ]
        });
    } catch (error) {
        console.error('Error handling team workload command:', error);
        await respond("Sorry, there was an error analyzing team workload.");
    }
});

// Team Availability Command
app.command('/team-availability', async ({ command, ack, respond }) => {
    try {
        await ack();
        const { user_id, text } = command;
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
    } catch (error) {
        console.error('Error handling team availability command:', error);
        await respond("Sorry, there was an error finding team availability.");
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

app.action('schedule_break', async ({ ack, body, client, respond }) => {
    await ack();
    
    try {
        const user_id = body.user.id;
        const tokens = await getTokens(user_id);

        if (!tokens) {
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
        const breakSuggestions = await suggestSmartBreaks(events);

        const blocks = [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "🌟 Available Break Slots",
                    emoji: true
                }
            }
        ];

        if (breakSuggestions.length > 0) {
            breakSuggestions.forEach((slot, index) => {
                // Add break information section
                blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${index + 1}. ${moment(slot.start).format('h:mm A')} - ${moment(slot.end).format('h:mm A')}*\n` +
                              `• Priority: ${slot.priority === 'high' ? '🔴' : '🟡'}\n` +
                              `• Type: ${slot.type === 'recovery' ? 'Recovery after meeting' : 'Available gap'}\n` +
                              `• ${slot.reason}`
                    }
                });

                // Add schedule button for this break
                blocks.push({
                    type: "actions",
                    elements: [
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "Schedule This Break ✨",
                                emoji: true
                            },
                            style: "primary",
                            value: JSON.stringify({
                                start: slot.start.toISOString(),
                                end: slot.end.toISOString(),
                                type: slot.type
                            }),
                            action_id: `schedule_break_slot_${index}`
                        }
                    ]
                });

                // Add divider between breaks
                if (index < breakSuggestions.length - 1) {
                    blocks.push({
                        type: "divider"
                    });
                }
            });
        } else {
            blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "No suitable break slots found for today. Consider rescheduling some meetings."
                }
            });
        }

        await respond({ blocks });
    } catch (error) {
        console.error('Error in schedule_break:', error);
        await respond("Sorry, there was an error scheduling your break.");
    }
});

// Handle break slot scheduling
app.action(/^schedule_break_slot_\d+$/, async ({ ack, body, respond }) => {
    await ack();
    try {
        const slotData = JSON.parse(body.actions[0].value);
        const user_id = body.user.id;
        const tokens = await getTokens(user_id);

        const eventDetails = {
            summary: '🧘‍♂️ Break Time',
            description: 'Time to recharge and stay productive!',
            start: {
                dateTime: slotData.start,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            end: {
                dateTime: slotData.end,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 5 }
                ]
            }
        };

        await createCalendarEvent(tokens.access_token, eventDetails);
        await respond({
            text: "✅ Break scheduled successfully! Don't forget to take it 😊",
            replace_original: false
        });
    } catch (error) {
        console.error('Error scheduling break slot:', error);
        await respond({
            text: "Sorry, there was an error scheduling your break.",
            replace_original: false
        });
    }
});

// New AI-powered commands
app.command('/optimize', async ({ command, ack, respond }) => {
    await ack();
    try {
        const [duration, ...purposeArray] = command.text.split(' ');
        const purpose = purposeArray.join(' ');
        
        const meetingDetails = {
            duration: parseInt(duration),
            purpose: purpose,
            attendees: [], // You'll need to implement attendee selection UI
            priority: "medium"
        };

        const optimization = await optimizeMeeting(meetingDetails);

        await respond({
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "🤖 Meeting Optimization Suggestions"
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: optimization.recommendations
                    }
                },
                {
                    type: "actions",
                    elements: [
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "Apply Suggestions"
                            },
                            action_id: "apply_optimization"
                        }
                    ]
                }
            ]
        });
    } catch (error) {
        console.error('Error optimizing meeting:', error);
        await respond("Sorry, couldn't optimize the meeting.");
    }
});

app.command('/focus', async ({ command, ack, respond }) => {
    await ack();
    try {
        const duration = command.text || '2h'; // Default 2 hours
        const focusTime = await handleFocusCommand(command, duration);
        
        await respond({
            blocks: [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `Found focus time: ${focusTime.start} - ${focusTime.end}`
                    }
                },
                {
                    type: "actions",
                    elements: [
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "Block This Time"
                            },
                            action_id: "block_focus_time",
                            value: JSON.stringify(focusTime)
                        }
                    ]
                }
            ]
        });
    } catch (error) {
        await respond("Couldn't find suitable focus time.");
    }
});

app.command('/summarize', async ({ command, ack, respond }) => {
    await ack();
    try {
        const eventId = command.text;
        const summary = await generateMeetingSummary(eventId);
        
        await respond({
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "📝 Meeting Summary"
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: summary
                    }
                }
            ]
        });
    } catch (error) {
        await respond("Couldn't generate meeting summary.");
    }
});

app.command('/efficiency', async ({ command, ack, respond }) => {
    await ack();
    try {
        const events = await getCalendarEvents(command.user_id);
        const efficiency = calculateMeetingEfficiency(events);
        
        await respond({
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "⚡ Meeting Efficiency Score"
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `Score: ${efficiency.score}/100\n\n*Factors:*\n${efficiency.factors.map(f => `• ${f.message}`).join('\n')}`
                    }
                }
            ]
        });
    } catch (error) {
        await respond("Couldn't calculate efficiency score.");
    }
});

app.command('/team-meet', async ({ command, ack, respond }) => {
    await ack();
    try {
        const [duration, ...participants] = command.text.split(' ');
        const optimalTime = await findOptimalTeamMeeting(participants, parseInt(duration));
        
        await respond({
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "👥 Optimal Team Meeting Times"
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `Best times for everyone:\n${optimalTime.suggestedTimes.map(t => `• ${t}`).join('\n')}`
                    }
                }
            ]
        });
    } catch (error) {
        await respond("Couldn't find optimal team meeting time.");
    }
});

// Meeting Summary Command
app.command('/meeting-summary', async ({ command, ack, respond }) => {
    try {
        await ack();
        const { user_id } = command;
        const tokens = await getTokens(user_id);

        if (!tokens) {
            await respond("Please authenticate first!");
            return;
        }

        const events = await getCalendarEvents(tokens.access_token);
        const latestEvent = events[0]; // Most recent event

        const summary = await generateMeetingSummary(
            latestEvent.description,
            latestEvent.attendees?.map(a => a.email) || [],
            moment(latestEvent.end.dateTime).diff(moment(latestEvent.start.dateTime), 'minutes')
        );

        await respond({
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "📝 Meeting Summary"
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: summary.summary
                    }
                }
            ]
        });
    } catch (error) {
        console.error('Error generating meeting summary:', error);
        await respond("Sorry, there was an error generating the meeting summary.");
    }
});

// Calendar Health Command
app.command('/calendar-health', async ({ command, ack, respond }) => {
    try {
        await ack();
        const { user_id } = command;
        const tokens = await getTokens(user_id);

        if (!tokens) {
            await respond("Please authenticate first!");
            return;
        }

        const events = await getCalendarEvents(tokens.access_token);
        const health = await calculateCalendarHealth(user_id, events);

        await respond({
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "🏥 Calendar Health Report"
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Overall Health Score: ${health.score}/100*\n\n*Metrics:*\n• Break Compliance: ${Math.round(health.breakCompliance * 100)}%\n• Focus Time: ${Math.round(health.focusTimeRatio * 100)}%\n• Meeting Efficiency: ${Math.round(health.meetingEfficiency * 100)}%\n• Work-Life Balance: ${Math.round(health.workLifeBalance * 100)}%`
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Positive Factors:*\n${health.details.positiveFactors.map(f => `• ${f}`).join('\n')}\n\n*Areas for Improvement:*\n${health.details.negativeFactors.map(f => `• ${f}`).join('\n')}`
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Recommendations:*\n${health.details.recommendations.map(r => `• ${r}`).join('\n')}`
                    }
                }
            ]
        });
    } catch (error) {
        console.error('Error calculating calendar health:', error);
        await respond("Sorry, there was an error generating your calendar health report.");
    }
});

// Meeting Recommendations Command
app.command('/optimize-meetings', async ({ command, ack, respond }) => {
    try {
        await ack();
        const { user_id, text } = command;
        const tokens = await getTokens(user_id);

        if (!tokens) {
            await respond("Please authenticate first!");
            return;
        }

        const timeMin = new Date();
        const timeMax = new Date();

        // Set time range based on command
        if (text.includes('week')) {
            timeMax.setDate(timeMax.getDate() + 7);
        } else {
            // Default to daily
            timeMax.setHours(23, 59, 59);
        }

        const events = await getCalendarEvents(tokens.access_token, timeMin.toISOString(), timeMax.toISOString());
        const recommendations = await generateMeetingRecommendations(user_id, events);
        const timeframe = text.includes('week') ? 'Weekly' : 'Daily';

        // Always provide some recommendations if none found
        if (recommendations.timeOptimization.length === 0) {
            recommendations.timeOptimization = [
                `Your ${timeframe.toLowerCase()} meeting schedule looks well-spaced`,
                "Consider protecting your focus time by blocking out 2-hour chunks"
            ];
        }

        if (recommendations.durationOptimization.length === 0) {
            recommendations.durationOptimization = [
                {
                    suggestion: `Your ${timeframe.toLowerCase()} meeting durations look appropriate`,
                    title: "General Feedback"
                },
                {
                    suggestion: "Consider setting default meeting duration to 25 mins instead of 30",
                    title: "Pro Tip"
                }
            ];
        }

        if (recommendations.formatOptimization.length === 0) {
            recommendations.formatOptimization = [
                {
                    suggestion: "Your meeting formats are well-chosen",
                    title: "General Feedback"
                },
                {
                    suggestion: "Consider making status updates asynchronous",
                    title: "Pro Tip"
                }
            ];
        }

        await respond({
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: `🎯 ${timeframe} Meeting Optimization Analysis`
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Time Management (${timeframe})*\n` + 
                            recommendations.timeOptimization.map(s => `• ${s}`).join('\n')
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Duration Efficiency (${timeframe})*\n` + 
                            recommendations.durationOptimization.map(s => `• ${s.suggestion}`).join('\n')
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Format & Structure (${timeframe})*\n` + 
                            recommendations.formatOptimization.map(s => `• ${s.suggestion}`).join('\n')
                    }
                },
                {
                    type: "context",
                    elements: [
                        {
                            type: "mrkdwn",
                            text: `Analyzing meetings from ${moment(timeMin).format('MMM D')} to ${moment(timeMax).format('MMM D')}`
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
                                text: "View Details"
                            },
                            action_id: "view_meeting_details"
                        }
                    ]
                }
            ]
        });
    } catch (error) {
        console.error('Error generating meeting recommendations:', error);
        await respond("Sorry, there was an error generating meeting recommendations.");
    }
});

// Add this after the other action handlers
app.action('view_meeting_details', async ({ ack, body, respond }) => {
    await ack();
    
    try {
        const user_id = body.user.id;
        const tokens = await getTokens(user_id);

        if (!tokens) {
            return await respond("Please authenticate first!");
        }

        const timeMin = new Date();
        const timeMax = new Date();
        timeMax.setHours(23, 59, 59);

        const events = await getCalendarEvents(tokens.access_token, timeMin.toISOString(), timeMax.toISOString());
        const efficiency = await calculateMeetingEfficiency(events);

        await respond({
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "📊 Detailed Meeting Analysis",
                        emoji: true
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Meeting Efficiency Score:* ${Math.round(efficiency.score * 100)}%`
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: "*Today's Meetings*\n" + events.map(event => 
                            `• ${moment(event.start.dateTime).format('h:mm A')} - ${moment(event.end.dateTime).format('h:mm A')}: ${event.summary || '(No title)'}\n  _Duration: ${moment(event.end.dateTime).diff(moment(event.start.dateTime), 'minutes')} mins_`
                        ).join('\n')
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Metrics*\n• Average Meeting Duration: ${efficiency.averageDuration} mins\n• Back-to-back Meetings: ${efficiency.backToBackCount}\n• Meetings Outside Work Hours: ${efficiency.outsideHoursCount}\n• Longest Meeting: ${efficiency.longestMeetingDuration} mins\n• Total Meetings: ${efficiency.totalMeetings}`
                    }
                }
            ],
            replace_original: false
        });
    } catch (error) {
        console.error('Error showing meeting details:', error);
        await respond({
            text: "Sorry, there was an error retrieving meeting details.",
            replace_original: false
        });
    }
});

export default app;