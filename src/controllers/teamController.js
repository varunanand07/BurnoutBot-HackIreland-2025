import moment from 'moment-timezone';

export const analyzeTeamWorkload = async (teamMembers, events) => {
    try {
        const teamMetrics = {
            totalMeetings: 0,
            averageMeetingsPerPerson: 0,
            totalMeetingHours: 0,
            memberWorkloads: {},
            recommendations: []
        };

        // Calculate per-member metrics
        teamMembers.forEach(member => {
            const memberEvents = events.filter(event => 
                event.attendees?.some(attendee => attendee.email === member.email)
            );

            const memberMetrics = calculateMemberMetrics(memberEvents);
            teamMetrics.memberWorkloads[member.email] = memberMetrics;
            teamMetrics.totalMeetings += memberMetrics.meetingCount;
            teamMetrics.totalMeetingHours += memberMetrics.totalHours;
        });

        // Calculate averages
        teamMetrics.averageMeetingsPerPerson = teamMetrics.totalMeetings / teamMembers.length;

        // Generate team-level recommendations
        teamMetrics.recommendations = generateTeamRecommendations(teamMetrics);

        return teamMetrics;
    } catch (error) {
        console.error('Error analyzing team workload:', error);
        throw error;
    }
};

function calculateMemberMetrics(events) {
    const metrics = {
        meetingCount: events.length,
        totalHours: 0,
        backToBackMeetings: 0,
        outOfHoursMeetings: 0
    };

    events.forEach((event, index) => {
        const start = moment(event.start.dateTime);
        const end = moment(event.end.dateTime);
        
        // Calculate total hours
        metrics.totalHours += end.diff(start, 'hours', true);

        // Check for back-to-back meetings
        if (index > 0) {
            const previousEnd = moment(events[index - 1].end.dateTime);
            if (start.diff(previousEnd, 'minutes') < 15) {
                metrics.backToBackMeetings++;
            }
        }

        // Check for out-of-hours meetings
        if (start.hour() < 9 || end.hour() >= 17) {
            metrics.outOfHoursMeetings++;
        }
    });

    return metrics;
}

function generateTeamRecommendations(teamMetrics) {
    const recommendations = [];

    // Check average meeting load
    if (teamMetrics.averageMeetingsPerPerson > 5) {
        recommendations.push({
            priority: 'high',
            message: 'Team meeting load is high. Consider implementing no-meeting days.'
        });
    }

    // Check workload distribution
    const workloads = Object.values(teamMetrics.memberWorkloads);
    const maxWorkload = Math.max(...workloads.map(w => w.totalHours));
    const minWorkload = Math.min(...workloads.map(w => w.totalHours));

    if (maxWorkload - minWorkload > 10) {
        recommendations.push({
            priority: 'medium',
            message: 'Meeting workload is unevenly distributed across the team.'
        });
    }

    // Check for excessive back-to-back meetings
    const totalBackToBack = workloads.reduce((sum, w) => sum + w.backToBackMeetings, 0);
    if (totalBackToBack > teamMetrics.totalMeetings * 0.3) {
        recommendations.push({
            priority: 'high',
            message: 'Too many back-to-back meetings. Encourage breaks between meetings.'
        });
    }

    return recommendations;
}

export const getTeamAvailability = (teamMembers, events, date) => {
    const availability = {
        commonSlots: [],
        memberAvailability: {}
    };

    const workStart = moment(date).set({ hour: 9, minute: 0 });
    const workEnd = moment(date).set({ hour: 17, minute: 0 });

    // Initialize 30-minute slots
    const slots = [];
    let currentSlot = workStart.clone();
    while (currentSlot < workEnd) {
        slots.push({
            start: currentSlot.clone(),
            end: currentSlot.clone().add(30, 'minutes'),
            availableMembers: [...teamMembers]
        });
        currentSlot.add(30, 'minutes');
    }

    // Remove busy slots for each member
    teamMembers.forEach(member => {
        const memberEvents = events.filter(event => 
            event.attendees?.some(attendee => attendee.email === member.email)
        );

        memberEvents.forEach(event => {
            const eventStart = moment(event.start.dateTime);
            const eventEnd = moment(event.end.dateTime);

            slots.forEach(slot => {
                if (slot.start.isBetween(eventStart, eventEnd) || 
                    slot.end.isBetween(eventStart, eventEnd)) {
                    slot.availableMembers = slot.availableMembers.filter(m => m !== member);
                }
            });
        });
    });

    // Find slots where all members are available
    availability.commonSlots = slots.filter(slot => 
        slot.availableMembers.length === teamMembers.length
    );

    return availability;
};

export const findOptimalTeamMeeting = async (teamMembers, events, duration = 60) => {
    try {
        const workingHours = {
            start: 9,  // 9 AM
            end: 17    // 5 PM
        };

        const nextFiveDays = Array.from({ length: 5 }, (_, i) => 
            moment().add(i + 1, 'days').startOf('day')
        );

        const possibleSlots = [];

        for (const day of nextFiveDays) {
            // Skip weekends
            if (day.day() === 0 || day.day() === 6) continue;

            const dayStart = day.clone().set('hour', workingHours.start);
            const dayEnd = day.clone().set('hour', workingHours.end);

            // Get team availability for this day
            const availability = getTeamAvailability(teamMembers, events, day);
            
            // Find slots where everyone is available
            const commonSlots = availability.commonSlots.filter(slot => 
                slot.availableMembers.length === teamMembers.length &&
                slot.end.diff(slot.start, 'minutes') >= duration
            );

            // Score each slot
            commonSlots.forEach(slot => {
                const score = calculateSlotScore(slot, teamMembers, events);
                possibleSlots.push({
                    start: slot.start,
                    end: slot.end,
                    score,
                    date: day.format('YYYY-MM-DD')
                });
            });
        }

        // Sort by score and return top 3 suggestions
        const bestSlots = possibleSlots
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        return {
            suggestions: bestSlots,
            message: bestSlots.length > 0 
                ? "Here are the best times for your team meeting"
                : "No suitable slots found in the next 5 working days"
        };
    } catch (error) {
        console.error('Error finding optimal team meeting time:', error);
        throw error;
    }
};

function calculateSlotScore(slot, teamMembers, events) {
    let score = 1;

    // Prefer mid-day slots (11 AM - 3 PM)
    const hour = slot.start.hour();
    if (hour >= 11 && hour <= 15) {
        score += 0.2;
    }

    // Avoid slots right after another meeting
    teamMembers.forEach(member => {
        const memberEvents = events.filter(event => 
            event.attendees?.some(attendee => attendee.email === member.email)
        );

        memberEvents.forEach(event => {
            const eventEnd = moment(event.end.dateTime);
            const timeDiff = slot.start.diff(eventEnd, 'minutes');
            
            if (timeDiff < 15 && timeDiff > 0) {
                score -= 0.1;
            }
        });
    });

    // Prefer earlier slots in the week
    const dayOfWeek = slot.start.day();
    score += (5 - dayOfWeek) * 0.05;

    return Math.max(0, score);
} 