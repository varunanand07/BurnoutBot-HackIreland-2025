import express from 'express';
import { getAuthUrl, handleGoogleCallback, storeTokens } from '../api/auth.js';

const router = express.Router();

router.get('/auth/google', (req, res) => {
  try {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).send('Authentication failed');
  }
});


router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('Received callback with state (userId):', state);
    
    if (!code) {
      throw new Error('No code received');
    }

    const tokens = await handleGoogleCallback(code);
    console.log('Received tokens:', tokens);
    
    if (!state) {
      throw new Error('No state (userId) received');
    }

    await storeTokens(state, tokens);
    
    res.send('Authentication successful! You can close this window and return to Slack.');
  } catch (error) {
    console.error('Error in callback:', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

export default router;