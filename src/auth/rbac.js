import { db } from '../firebase/firebase.js';
import { logger } from '../utils/logger.js';

// Define role hierarchy and permissions
const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user'
};

const PERMISSIONS = {
  VIEW_TEAM_WORKLOAD: 'view_team_workload',
  MODIFY_TEAM_CALENDAR: 'modify_team_calendar',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_USERS: 'manage_users',
  CONFIGURE_SETTINGS: 'configure_settings'
};

// Role to permissions mapping
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_TEAM_WORKLOAD,
    PERMISSIONS.MODIFY_TEAM_CALENDAR,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.CONFIGURE_SETTINGS
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_TEAM_WORKLOAD,
    PERMISSIONS.MODIFY_TEAM_CALENDAR,
    PERMISSIONS.VIEW_ANALYTICS
  ],
  [ROLES.USER]: []
};

// Check if user has permission
export const hasPermission = async (userId, permission) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      logger.warn(`User ${userId} not found when checking permissions`);
      return false;
    }
    
    const userData = userDoc.data();
    const userRole = userData.role || ROLES.USER;
    
    // Check if the user's role has the required permission
    return ROLE_PERMISSIONS[userRole].includes(permission);
  } catch (error) {
    logger.error(`Error checking permission for user ${userId}:`, error);
    return false;
  }
};

// Middleware to check permission
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const hasAccess = await hasPermission(userId, permission);
    
    if (!hasAccess) {
      // Log unauthorized access attempt
      logger.warn(`Unauthorized access attempt: User ${userId} tried to access ${permission}`);
      
      // Add to audit log
      await db.collection('audit_logs').add({
        userId,
        action: 'UNAUTHORIZED_ACCESS',
        resource: permission,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}; 