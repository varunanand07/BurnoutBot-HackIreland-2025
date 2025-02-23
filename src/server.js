import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import slackApp from './slackbot.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', authRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Start the Slack app
(async () => {
  await slackApp.start();
  console.log('⚡️ Slack Bolt app is running!');
})();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});