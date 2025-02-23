import express from "express";
import { getSortPriority} from "../controllers/aiController.js";

const router = express.Router();

router.post("/sort-priority", getSortPriority);




export default router;
