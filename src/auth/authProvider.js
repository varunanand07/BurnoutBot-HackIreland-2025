import { OAuth2Client } from 'google-auth-library';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import OktaStrategy from 'passport-okta-oauth';
import AzureAdPkg from 'passport-azure-ad';
const { BearerStrategy: AzureAdStrategy } = AzureAdPkg;
import { db } from '../firebase/firebase.js';
import { encryptData, decryptData } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

// Initialize OAuth clients
const googleOAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate authentication URL for Google OAuth
export const getAuthUrl = () => {
  return googleOAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/calendar'
    ],
    prompt: 'consent'
  });
};

// Configure passport with multiple strategies
export const configureAuth = (app) => {
  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Set up serialization/deserialization
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id, done) => {
    try {
      const userRef = db.collection('users').doc(id);
      const user = await userRef.get();
      done(null, user.data());
    } catch (error) {
      logger.error('Error deserializing user:', error);
      done(error, null);
    }
  });
  
  // Configure Google OAuth
  passport.use('google', googleOAuth2Client);
  
  // Configure SAML (for enterprise SSO)
  if (process.env.ENABLE_SAML === 'true') {
    passport.use('saml', new SamlStrategy({
      entryPoint: process.env.SAML_ENTRY_POINT,
      issuer: process.env.SAML_ISSUER,
      callbackUrl: process.env.SAML_CALLBACK_URL,
      cert: process.env.SAML_CERT,
      identifierFormat: process.env.SAML_IDENTIFIER_FORMAT
    }, (profile, done) => {
      // Map SAML profile to user object
      return done(null, {
        id: profile.nameID,
        email: profile.email,
        name: profile.displayName
      });
    }));
  }
  
  // Configure Okta (if enabled)
  if (process.env.ENABLE_OKTA === 'true') {
    passport.use('okta', new OktaStrategy({
      audience: process.env.OKTA_AUDIENCE,
      clientID: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      callbackURL: process.env.OKTA_CALLBACK_URL,
      scope: ['openid', 'email', 'profile']
    }, (accessToken, refreshToken, profile, done) => {
      return done(null, {
        id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName
      });
    }));
  }
  
  // Configure Azure AD (if enabled)
  if (process.env.ENABLE_AZURE_AD === 'true') {
    passport.use('azure-ad', new AzureAdStrategy({
      identityMetadata: process.env.AZURE_AD_IDENTITY_METADATA,
      clientID: process.env.AZURE_AD_CLIENT_ID,
      responseType: 'code id_token',
      responseMode: 'form_post',
      redirectUrl: process.env.AZURE_AD_REDIRECT_URL,
      allowHttpForRedirectUrl: false,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      validateIssuer: true,
      issuer: process.env.AZURE_AD_ISSUER,
      passReqToCallback: false,
      scope: ['profile', 'email', 'offline_access', 'https://outlook.office.com/calendars.read']
    }, (iss, sub, profile, accessToken, refreshToken, done) => {
      return done(null, {
        id: profile.oid,
        email: profile.upn,
        name: profile.displayName
      });
    }));
  }
};

// Store tokens securely
export const storeTokens = async (userId, tokens) => {
  try {
    // Encrypt tokens before storing
    const encryptedTokens = encryptData(JSON.stringify(tokens));
    
    await db.collection('tokens').doc(userId).set({
      encrypted: encryptedTokens,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    });
    
    // Log the token storage (without sensitive data)
    logger.info(`Tokens stored for user ${userId}`);
    
    // Add audit log
    await db.collection('audit_logs').add({
      userId,
      action: 'STORE_TOKENS',
      timestamp: new Date().toISOString(),
      ipAddress: 'N/A', // In a real implementation, capture this from the request
      userAgent: 'N/A'  // In a real implementation, capture this from the request
    });
    
    return true;
  } catch (error) {
    logger.error(`Error storing tokens for user ${userId}:`, error);
    return false;
  }
};

// Retrieve tokens securely
export const getTokens = async (userId) => {
  try {
    const tokenDoc = await db.collection('tokens').doc(userId).get();
    
    if (!tokenDoc.exists) {
      logger.info(`No tokens found for user ${userId}`);
      return null;
    }
    
    const tokenData = tokenDoc.data();
    const decryptedTokens = JSON.parse(decryptData(tokenData.encrypted));
    
    // Add audit log for token retrieval
    await db.collection('audit_logs').add({
      userId,
      action: 'RETRIEVE_TOKENS',
      timestamp: new Date().toISOString(),
      ipAddress: 'N/A',
      userAgent: 'N/A'
    });
    
    return decryptedTokens;
  } catch (error) {
    logger.error(`Error retrieving tokens for user ${userId}:`, error);
    return null;
  }
}; 