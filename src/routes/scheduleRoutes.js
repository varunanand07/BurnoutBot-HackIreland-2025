import express from "express";
import { findOptimalMeetingSlot } from "../controllers/scheduleController.js";
import { suggestSmartBreaks } from "../controllers/breakController.js";
import { logger, auditLog } from "../utils/logger.js";

const router = express.Router();

// Find optimal meeting slots
router.post("/optimal-slots", async (req, res) => {
  try {
    const { participants, duration } = req.body;
    
    if (!participants || !duration) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const slots = await findOptimalMeetingSlot(participants, duration);
    
    // Log the request
    await auditLog(req.user?.id || "anonymous", "OPTIMAL_SLOTS_REQUESTED", {
      participantCount: participants.length,
      duration
    });
    
    res.json(slots);
  } catch (error) {
    logger.error("Error finding optimal meeting slots:", error);
    res.status(500).json({ error: "Failed to find optimal meeting slots" });
  }
});

// Suggest smart breaks
router.post("/suggest-breaks", async (req, res) => {
  try {
    const { events, userId } = req.body;
    
    if (!events) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const breaks = await suggestSmartBreaks(events);
    
    // Log the request
    if (userId) {
      await auditLog(userId, "BREAKS_SUGGESTED", {
        breakCount: breaks.length
      });
    }
    
    res.json(breaks);
  } catch (error) {
    logger.error("Error suggesting breaks:", error);
    res.status(500).json({ error: "Failed to suggest breaks" });
  }
});

export default router;