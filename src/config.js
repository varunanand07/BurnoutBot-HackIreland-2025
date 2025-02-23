import dotenv from 'dotenv';

dotenv.config();

export const SLACK_CONFIG = {
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  appToken: process.env.SLACK_APP_TOKEN
};