import moment from 'moment-timezone';

export const analyzeMeetingPatterns = (events) => {
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
};

export const calculateMeetingMetrics = (events) => {
    const metrics = {
        totalMeetings: events.length,
        totalDuration: 0,
        averageDuration: 0,
        meetingsPerDay: {},
        busyHours: new Array(24).fill(0)
    };

    events.forEach(event => {
        const start = moment(event.start.dateTime);
        const end = moment(event.end.dateTime);
        const duration = end.diff(start, 'minutes');
        const day = start.format('YYYY-MM-DD');

        // Calculate total and average duration
        metrics.totalDuration += duration;

        // Track meetings per day
        metrics.meetingsPerDay[day] = (metrics.meetingsPerDay[day] || 0) + 1;

        // Track busy hours
        for (let hour = start.hour(); hour <= end.hour(); hour++) {
            metrics.busyHours[hour]++;
        }
    });

    metrics.averageDuration = metrics.totalDuration / events.length;

    return metrics;
};

export const calculateMeetingEfficiency = (events) => {
    try {
        if (!events || !Array.isArray(events)) {
            throw new Error('Invalid events data');
        }

        const workHours = {
            start: 9,  // 9 AM
            end: 17    // 5 PM
        };

        let totalDuration = 0;
        let backToBackCount = 0;
        let outsideHoursCount = 0;
        let longestMeetingDuration = 0;
        let previousEventEnd = null;

        // Filter out undefined or invalid events
        const validEvents = events.filter(event => 
            event && event.start && event.end && 
            event.start.dateTime && event.end.dateTime
        );

        validEvents.forEach((event, index) => {
            const start = moment(event.start.dateTime);
            const end = moment(event.end.dateTime);
            const duration = end.diff(start, 'minutes');

            // Calculate total duration
            totalDuration += duration;

            // Check for longest meeting
            longestMeetingDuration = Math.max(longestMeetingDuration, duration);

            // Check for back-to-back meetings
            if (previousEventEnd) {
                const gap = start.diff(previousEventEnd, 'minutes');
                if (gap < 15) { // Less than 15 minutes between meetings
                    backToBackCount++;
                }
            }

            // Check for meetings outside work hours
            const startHour = start.hours();
            const endHour = end.hours();
            if (startHour < workHours.start || endHour > workHours.end) {
                outsideHoursCount++;
            }

            previousEventEnd = end;
        });

        // Calculate efficiency score (0-1)
        const metrics = {
            backToBackRatio: 1 - (backToBackCount / Math.max(validEvents.length - 1, 1)),
            workHoursRatio: 1 - (outsideHoursCount / validEvents.length),
            durationRatio: 1 - (Math.max(0, totalDuration - 240) / 480) // Penalize if total duration > 4 hours
        };

        const score = (
            metrics.backToBackRatio * 0.4 +
            metrics.workHoursRatio * 0.3 +
            metrics.durationRatio * 0.3
        );

        return {
            score: Math.max(0, Math.min(1, score)), // Ensure score is between 0 and 1
            averageDuration: Math.round(totalDuration / validEvents.length),
            backToBackCount,
            outsideHoursCount,
            longestMeetingDuration,
            totalMeetings: validEvents.length
        };
    } catch (error) {
        console.error('Error calculating meeting efficiency:', error);
        return {
            score: 0,
            averageDuration: 0,
            backToBackCount: 0,
            outsideHoursCount: 0,
            longestMeetingDuration: 0,
            totalMeetings: 0
        };
    }
};

export const generateAnalyticsReport = (events) => {
    const patterns = analyzeMeetingPatterns(events);
    const metrics = calculateMeetingMetrics(events);

    return {
        patterns,
        metrics,
        recommendations: generateRecommendations(patterns, metrics)
    };
};

function generateRecommendations(patterns, metrics) {
    const recommendations = [];

    // Check for too many back-to-back meetings
    if (patterns.backToBack > 3) {
        recommendations.push({
            type: 'warning',
            message: 'Consider adding breaks between meetings to avoid burnout'
        });
    }

    // Check for early/late meetings
    if (patterns.earlyMorning > 0 || patterns.lateEvening > 0) {
        recommendations.push({
            type: 'suggestion',
            message: 'Try to schedule meetings within core work hours (9 AM - 5 PM)'
        });
    }

    // Check for long meetings
    if (patterns.longMeetings > 2) {
        recommendations.push({
            type: 'optimization',
            message: 'Consider breaking down longer meetings into shorter sessions'
        });
    }

    // Check average meeting duration
    if (metrics.averageDuration > 45) {
        recommendations.push({
            type: 'optimization',
            message: 'Your average meeting duration is high. Consider setting 30-minute meetings as default'
        });
    }

    return recommendations;
} 