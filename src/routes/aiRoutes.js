import express from "express";
import { generateMeetingSummary, generateMeetingRecommendations, calculateCalendarHealth } from "../controllers/aiController.js";
import { optimizeMeeting } from "../controllers/aiMeetingOptimizer.js";
import { logger, auditLog } from "../utils/logger.js";

const router = express.Router();

// Generate meeting summary
router.post("/meeting-summary", async (req, res) => {
  try {
    const { meetingDetails, userId } = req.body;
    
    if (!meetingDetails) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const summary = await generateMeetingSummary(meetingDetails);
    
    // Log the request
    if (userId) {
      await auditLog(userId, "MEETING_SUMMARY_GENERATED", {
        meetingId: meetingDetails.id
      });
    }
    
    res.json(summary);
  } catch (error) {
    logger.error("Error generating meeting summary:", error);
    res.status(500).json({ error: "Failed to generate meeting summary" });
  }
});

// Generate meeting recommendations
router.post("/meeting-recommendations", async (req, res) => {
  try {
    const { events, timeframe, userId } = req.body;
    
    if (!events) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const recommendations = await generateMeetingRecommendations(events, timeframe || "Daily");
    
    // Log the request
    if (userId) {
      await auditLog(userId, "RECOMMENDATIONS_GENERATED", {
        eventCount: events.length,
        timeframe: timeframe || "Daily"
      });
    }
    
    res.json(recommendations);
  } catch (error) {
    logger.error("Error generating meeting recommendations:", error);
    res.status(500).json({ error: "Failed to generate meeting recommendations" });
  }
});

// Calculate calendar health
router.post("/calendar-health", async (req, res) => {
  try {
    const { events, userId } = req.body;
    
    if (!events) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const health = await calculateCalendarHealth(events);
    
    // Log the request
    if (userId) {
      await auditLog(userId, "CALENDAR_HEALTH_CALCULATED", {
        score: health.overallScore
      });
    }
    
    res.json(health);
  } catch (error) {
    logger.error("Error calculating calendar health:", error);
    res.status(500).json({ error: "Failed to calculate calendar health" });
  }
});

// Optimize meeting
router.post("/optimize-meeting", async (req, res) => {
  try {
    const { meetingDetails, userId } = req.body;
    
    if (!meetingDetails) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const optimization = await optimizeMeeting(meetingDetails);
    
    // Log the request
    if (userId) {
      await auditLog(userId, "MEETING_OPTIMIZED", {
        duration: meetingDetails.duration,
        attendeeCount: meetingDetails.attendees?.length || 0
      });
    }
    
    res.json(optimization);
  } catch (error) {
    logger.error("Error optimizing meeting:", error);
    res.status(500).json({ error: "Failed to optimize meeting" });
  }
});

export default router;
