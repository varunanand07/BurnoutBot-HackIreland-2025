import moment from 'moment-timezone';

export const suggestBreakTime = async (events, duration = 30) => {
    try {
        // Get current time
        const now = moment();
        const endOfDay = moment().endOf('day');
        
        // Sort events by start time
        const sortedEvents = events.sort((a, b) => 
            moment(a.start.dateTime).valueOf() - moment(b.start.dateTime).valueOf()
        );

        // Find gaps between meetings
        let availableSlots = [];
        let currentTime = now;

        for (const event of sortedEvents) {
            const eventStart = moment(event.start.dateTime);
            const eventEnd = moment(event.end.dateTime);

            // Skip past events
            if (eventEnd.isBefore(now)) continue;

            // Check if there's enough time before this meeting
            const gapDuration = eventStart.diff(currentTime, 'minutes');
            if (gapDuration >= duration) {
                availableSlots.push({
                    start: currentTime.toDate(),
                    end: currentTime.clone().add(duration, 'minutes').toDate()
                });
            }

            currentTime = eventEnd;
        }

        // Check for slot after last meeting
        if (currentTime.isBefore(endOfDay)) {
            availableSlots.push({
                start: currentTime.toDate(),
                end: currentTime.clone().add(duration, 'minutes').toDate()
            });
        }

        // If no slots found, suggest tomorrow morning
        if (availableSlots.length === 0) {
            const tomorrow = moment().add(1, 'day').startOf('day').add(9, 'hours');
            availableSlots.push({
                start: tomorrow.toDate(),
                end: tomorrow.clone().add(duration, 'minutes').toDate()
            });
        }

        // Return the first available slot
        return availableSlots[0];
    } catch (error) {
        console.error('Error suggesting break time:', error);
        throw error;
    }
};

export const validateBreakTime = (startTime, endTime, existingEvents) => {
    try {
        const breakStart = moment(startTime);
        const breakEnd = moment(endTime);

        // Check if break is during work hours (9 AM - 5 PM)
        if (breakStart.hours() < 9 || breakEnd.hours() >= 17) {
            return {
                isValid: false,
                reason: "Break should be scheduled during work hours (9 AM - 5 PM)"
            };
        }

        // Check for conflicts with existing events
        for (const event of existingEvents) {
            const eventStart = moment(event.start.dateTime);
            const eventEnd = moment(event.end.dateTime);

            if (breakStart.isBetween(eventStart, eventEnd) || 
                breakEnd.isBetween(eventStart, eventEnd) ||
                (breakStart.isBefore(eventStart) && breakEnd.isAfter(eventEnd))) {
                return {
                    isValid: false,
                    reason: `Break conflicts with existing event: ${event.summary}`
                };
            }
        }

        return {
            isValid: true,
            reason: "Break time is valid"
        };
    } catch (error) {
        console.error('Error validating break time:', error);
        throw error;
    }
};

export const formatBreakEvent = (startTime, endTime) => {
    return {
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
};

export const suggestSmartBreaks = async (events) => {
    try {
        const breakSuggestions = [];
        let lastEventEnd = null;
        
        // Filter out all-day events and sort remaining events by start time
        const sortedEvents = events
            .filter(event => event.start.dateTime && event.end.dateTime)
            .sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));

        if (sortedEvents.length === 0) {
            return breakSuggestions;
        }

        // Get the time bounds from first and last meeting
        const firstMeeting = moment(sortedEvents[0].start.dateTime);
        const lastMeeting = moment(sortedEvents[sortedEvents.length - 1].end.dateTime);

        sortedEvents.forEach((event, index) => {
            const eventStart = moment(event.start.dateTime);
            const eventEnd = moment(event.end.dateTime);

            // Check for gaps between meetings
            if (lastEventEnd) {
                const gapDuration = eventStart.diff(lastEventEnd, 'minutes');
                if (gapDuration >= 30) {  // Changed minimum gap to 30 minutes
                    breakSuggestions.push({
                        start: lastEventEnd.clone(),
                        end: lastEventEnd.clone().add(30, 'minutes'),
                        type: 'gap',
                        priority: gapDuration >= 60 ? 'high' : 'medium',
                        reason: `${gapDuration} minute gap available between meetings`
                    });

                    // If gap is longer than 1 hour, suggest another break in the middle
                    if (gapDuration >= 90) {
                        const midPoint = moment(lastEventEnd).add(gapDuration / 2, 'minutes');
                        breakSuggestions.push({
                            start: midPoint.clone().subtract(15, 'minutes'),
                            end: midPoint.clone().add(15, 'minutes'),
                            type: 'gap',
                            priority: 'high',
                            reason: 'Extended break during long gap'
                        });
                    }
                }
            }

            lastEventEnd = eventEnd;

            // Suggest breaks after long meetings
            const meetingDuration = eventEnd.diff(eventStart, 'minutes');
            if (meetingDuration >= 90) {
                breakSuggestions.push({
                    start: eventEnd.clone(),
                    end: eventEnd.clone().add(30, 'minutes'),
                    type: 'recovery',
                    priority: 'high',
                    reason: 'Recovery break after long meeting'
                });
            }
        });

        return breakSuggestions;
    } catch (error) {
        console.error('Error in suggestSmartBreaks:', error);
        return [];
    }
}; 