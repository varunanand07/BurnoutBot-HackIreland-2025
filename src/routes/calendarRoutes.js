import express from "express";
import { getAllEvents, createEventSpecific, deleteEventSpecific, getAllCalendars } from "../controllers/calendarController.js";
import checkAuth from "../middleware/checkAuth.js";

const router = express.Router();

router.get("/events/all", checkAuth, getAllEvents);
router.get("/calendars", checkAuth, getAllCalendars);
//router.post("/events/create", checkAuth, createEvent);
router.post("/events/:calendarId", checkAuth, createEventSpecific);
router.delete("/events/:calendarId/:eventId", checkAuth, deleteEventSpecific);




export default router;
