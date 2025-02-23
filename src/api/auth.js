import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = path.join(__dirname, '../../tokens.json');

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const getTokens = async (userId) => {
  try {
    const data = await fs.readFile(TOKENS_FILE, 'utf8');
    const allTokens = JSON.parse(data);
    const tokens = allTokens[userId];
    
    if (!tokens) {
      console.log('No tokens found for user:', userId);
      return null;
    }

    // Check if token needs refresh
    if (tokens.refresh_token && (tokens.expiry_date < Date.now() || !tokens.access_token)) {
      console.log('Token expired or invalid, refreshing...');
      oauth2Client.setCredentials({
        refresh_token: tokens.refresh_token
      });
      
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        console.log('Token refreshed successfully');
        
        // Preserve the refresh token as it might not be included in new credentials
        credentials.refresh_token = credentials.refresh_token || tokens.refresh_token;
        
        await storeTokens(userId, credentials);
        return credentials;
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        return null;
      }
    }

    return tokens;
  } catch (error) {
    console.error('Error getting tokens:', error);
    return null;
  }
};

export const storeTokens = async (userId, tokens) => {
  try {
    let allTokens = {};
    try {
      const data = await fs.readFile(TOKENS_FILE, 'utf8');
      allTokens = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty object
    }

    // Ensure we have an expiry_date
    if (!tokens.expiry_date && tokens.expires_in) {
      tokens.expiry_date = Date.now() + (tokens.expires_in * 1000);
    }

    allTokens[userId] = tokens;
    await fs.writeFile(TOKENS_FILE, JSON.stringify(allTokens, null, 2));
    console.log('Tokens stored for user:', userId);
    return true;
  } catch (error) {
    console.error('Error storing tokens:', error);
    return false;
  }
};

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
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Received tokens from Google:', tokens);
    return tokens;
  } catch (error) {
    console.error('Error getting tokens from Google:', error);
    throw error;
  }
};import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events"
];

const getAuthUrl = () => {
    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
    });
};

export { oauth2Client, getAuthUrl };