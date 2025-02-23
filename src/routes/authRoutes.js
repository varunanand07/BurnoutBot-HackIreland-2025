import express from 'express';
import { getAuthUrl, handleAuthCallback, saveTokens } from '../api/auth.js';

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
    console.log('Received callback with state:', state);
    
    if (!code) {
      throw new Error('No code received');
    }

    if (!state) {
      throw new Error('No state (userId) received');
    }

    // Decode the state to get userId
    let userId;
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = decodedState.userId;
      console.log('Decoded userId:', userId);
    } catch (error) {
      console.error('Error decoding state:', error);
      throw new Error('Invalid state format');
    }

    const tokens = await handleAuthCallback(code);
    console.log('Received tokens:', { ...tokens, access_token: '***redacted***' });
    
    await saveTokens(userId, tokens);
    console.log('Tokens stored successfully for user:', userId);
    
    res.send(`
      <html>
        <body>
          <h1>Authentication successful!</h1>
          <p>You can close this window and return to Slack.</p>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in callback:', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

export default router;