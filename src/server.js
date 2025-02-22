import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import slackApp from './slackbot.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', authRoutes);

(async () => {
  await slackApp.start(PORT);
  console.log('⚡️ Bolt app is running!');
})();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});