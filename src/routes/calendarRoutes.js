import express from "express";
import { getAllEvents, createEvent } from "../controllers/calendarController.js";
import checkAuth from "../middleware/checkAuth.js";

const router = express.Router();

router.get("/events/all", checkAuth, getAllEvents);
router.post("/events/create", checkAuth, createEvent);

export default router;