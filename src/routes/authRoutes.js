import express from "express";
import { googleAuth, googleCallback } from "../controllers/authController.js";

const router = express.Router();

router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

export default router;