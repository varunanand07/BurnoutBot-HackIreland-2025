import express from 'express';
import passport from 'passport';
import { getAuthUrl, getTokens, storeTokens } from '../auth/authProvider.js';
import { logger, auditLog } from '../utils/logger.js';

const router = express.Router();

// Google OAuth login route
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar']
}));

// Google OAuth callback route
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/auth/failed' }),
  async (req, res) => {
    try {
      // Store tokens securely
      await storeTokens(req.user.id, {
        access_token: req.authInfo.access_token,
        refresh_token: req.authInfo.refresh_token,
        expiry_date: req.authInfo.expiry_date
      });
      
      // Log successful authentication
      await auditLog(req.user.id, 'USER_AUTHENTICATED', {
        method: 'google'
      });
      
      res.redirect('/auth/success');
    } catch (error) {
      logger.error('Error in auth callback:', error);
      res.redirect('/auth/failed');
    }
  }
);

// Auth success page
router.get('/success', (req, res) => {
  res.send('Authentication successful! You can close this window and return to Slack.');
});

// Auth failure page
router.get('/failed', (req, res) => {
  res.send('Authentication failed. Please try again.');
});

export default router;