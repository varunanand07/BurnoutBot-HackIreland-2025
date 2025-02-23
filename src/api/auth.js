import { google } from 'googleapis';
import { GOOGLE_CONFIG } from '../config.js';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = path.join(__dirname, '../../tokens.json');

// Initialize Firebase
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

export const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CONFIG.clientId,
    GOOGLE_CONFIG.clientSecret,
    GOOGLE_CONFIG.redirectUri
);

export const getTokens = async (userId) => {
    if (!userId) {
        console.error('No userId provided to getTokens');
        return null;
    }
    
    try {
        console.log('Getting tokens for userId:', userId);
        const tokensRef = ref(database, `tokens/${userId}`);
        const snapshot = await get(tokensRef);
        
        if (snapshot.exists()) {
            const tokens = snapshot.val();
            console.log('Retrieved tokens from Firebase for userId:', userId);
            
            // Check if tokens need refresh
            if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
                console.log('Tokens expired, refreshing...');
                oauth2Client.setCredentials(tokens);
                const { credentials } = await oauth2Client.refreshAccessToken();
                await saveTokens(userId, credentials);
                return credentials;
            }
            
            return tokens;
        } else {
            console.log('No tokens found in Firebase for userId:', userId);
            return null;
        }
    } catch (error) {
        console.error('Error getting tokens:', error);
        return null;
    }
};

export const saveTokens = async (userId, tokens) => {
    if (!userId) {
        throw new Error('No userId provided to saveTokens');
    }
    if (!tokens) {
        throw new Error('No tokens provided to saveTokens');
    }
    
    try {
        console.log('Saving tokens for userId:', userId);
        const tokenData = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            scope: tokens.scope,
            token_type: tokens.token_type,
            expiry_date: tokens.expiry_date
        };
        
        const tokensRef = ref(database, `tokens/${userId}`);
        await set(tokensRef, tokenData);
        oauth2Client.setCredentials(tokenData);
        
        console.log('Tokens saved successfully to Firebase for userId:', userId);
        return tokenData;
    } catch (error) {
        console.error('Error saving tokens:', error);
        throw error;
    }
};

export const getAuthUrl = (userId) => {
    if (!userId) {
        throw new Error('No userId provided to getAuthUrl');
    }
    
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
        ],
        state: state,
        prompt: 'consent'
    });
};

export const handleAuthCallback = async (code) => {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        if (!tokens) {
            throw new Error('No tokens received from Google');
        }
        oauth2Client.setCredentials(tokens);
        return tokens;
    } catch (error) {
        console.error('Error getting tokens:', error);
        throw error;
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
