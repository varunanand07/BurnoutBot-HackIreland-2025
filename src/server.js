import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import authRoutes from "./routes/authRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import slackApp from './slackbot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes
app.use('/', authRoutes);
app.use('/', calendarRoutes);
app.use('/', scheduleRoutes);
app.use('/', aiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 4000; // Changed to match your .env configuration

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

export default app;

// Start the Slack app
(async () => {
    try {
        await slackApp.start();
        console.log('⚡️ Slack Bolt app is running!');
    } catch (error) {
        console.error('Error starting Slack app:', error);
    }
})();
