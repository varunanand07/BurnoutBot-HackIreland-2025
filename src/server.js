import express from "express";
import dotenv from "dotenv";
import authRoutes from "../src/routes/authRoutes.js";
import calendarRoutes from "../src/routes/calendarRoutes.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/auth", authRoutes);
app.use("/calendar", calendarRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));