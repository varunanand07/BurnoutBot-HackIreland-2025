import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = path.join(__dirname, '../../tokens.json');

const loadTokens = async () => {
  try {
    const data = await fs.readFile(TOKENS_FILE, 'utf8');
    console.log('Loaded tokens from file:', data);
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(TOKENS_FILE, '{}');
      return {};
    }
    console.error('Error loading tokens:', error);
    return {};
  }
};

const saveTokens = async (tokens) => {
  try {
    await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2));
    console.log('Tokens saved successfully to:', TOKENS_FILE);
  } catch (error) {
    console.error('Error saving tokens:', error);
    throw error;
  }
};

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const getAuthUrl = (slackUserId) => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar'
    ],
    include_granted_scopes: true,
    prompt: 'consent',
    state: slackUserId
  });
};

export const handleGoogleCallback = async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

export const storeTokens = async (userId, tokens) => {
  try {
    console.log('Storing tokens for user:', userId);
    const allTokens = await loadTokens();
    allTokens[userId] = tokens;
    await saveTokens(allTokens);
    console.log('Tokens stored successfully');
    const verifyTokens = await loadTokens();
    console.log('Verification - stored tokens:', verifyTokens[userId]);
  } catch (error) {
    console.error('Error in storeTokens:', error);
    throw error;
  }
};

export const getTokens = async (userId) => {
  try {
    console.log('Getting tokens for user:', userId);
    const allTokens = await loadTokens();
    const tokens = allTokens[userId];
    console.log('Retrieved tokens for user:', tokens);
    return tokens;
  } catch (error) {
    console.error('Error in getTokens:', error);
    return null;
  }
};