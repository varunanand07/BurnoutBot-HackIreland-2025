import { db } from '../firebase/firebase.js';
import { logger, auditLog } from './logger.js';

// Default retention periods (in days)
const DEFAULT_RETENTION_PERIODS = {
  audit_logs: 365,  // 1 year
  tokens: 90,       // 90 days
  calendar_data: 30, // 30 days
  analytics: 180    // 6 months
};

// Get organization-specific retention periods
const getRetentionPeriods = async (orgId) => {
  try {
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    
    if (!orgDoc.exists) {
      return DEFAULT_RETENTION_PERIODS;
    }
    
    const orgData = orgDoc.data();
    return {
      ...DEFAULT_RETENTION_PERIODS,
      ...(orgData.retentionPeriods || {})
    };
  } catch (error) {
    logger.error(`Error getting retention periods for org ${orgId}:`, error);
    return DEFAULT_RETENTION_PERIODS;
  }
};

// Apply data retention policy
export const applyDataRetention = async (orgId) => {
  try {
    const retentionPeriods = await getRetentionPeriods(orgId);
    const now = new Date();
    
    // Process each collection with its retention period
    for (const [collection, days] of Object.entries(retentionPeriods)) {
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      // Query for documents older than the cutoff date
      const snapshot = await db.collection(collection)
        .where('timestamp', '<', cutoffDate.toISOString())
        .get();
      
      // Delete expired documents
      const batch = db.batch();
      let count = 0;
      
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
        count++;
      });
      
      if (count > 0) {
        await batch.commit();
        logger.info(`Deleted ${count} expired documents from ${collection}`);
        
        // Log the purge action
        await auditLog('system', 'DATA_RETENTION_PURGE', {
          collection,
          count,
          retentionDays: days,
          cutoffDate: cutoffDate.toISOString()
        });
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Error applying data retention for org ${orgId}:`, error);
    return false;
  }
};

// Data export for compliance (GDPR, etc.)
export const exportUserData = async (userId) => {
  try {
    const userData = {};
    
    // Get user profile
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      userData.profile = userDoc.data();
    }
    
    // Get user tokens (without sensitive parts)
    const tokenDoc = await db.collection('tokens').doc(userId).get();
    if (tokenDoc.exists) {
      userData.tokens = {
        created: tokenDoc.data().created,
        updated: tokenDoc.data().updated
      };
    }
    
    // Get user's calendar data
    const calendarSnapshot = await db.collection('calendar_data')
      .where('userId', '==', userId)
      .get();
    
    userData.calendarData = [];
    calendarSnapshot.forEach(doc => {
      userData.calendarData.push(doc.data());
    });
    
    // Get user's audit logs
    const auditSnapshot = await db.collection('audit_logs')
      .where('userId', '==', userId)
      .get();
    
    userData.auditLogs = [];
    auditSnapshot.forEach(doc => {
      userData.auditLogs.push(doc.data());
    });
    
    // Log the export
    await auditLog('system', 'USER_DATA_EXPORT', { userId });
    
    return userData;
  } catch (error) {
    logger.error(`Error exporting data for user ${userId}:`, error);
    throw error;
  }
};

// Delete all user data (right to be forgotten)
export const deleteUserData = async (userId, requestedBy) => {
  try {
    // Log the deletion request
    await auditLog(requestedBy, 'USER_DATA_DELETION_REQUEST', { targetUserId: userId });
    
    // Delete user profile
    await db.collection('users').doc(userId).delete();
    
    // Delete user tokens
    await db.collection('tokens').doc(userId).delete();
    
    // Delete user's calendar data
    const calendarSnapshot = await db.collection('calendar_data')
      .where('userId', '==', userId)
      .get();
    
    const batch1 = db.batch();
    calendarSnapshot.forEach(doc => {
      batch1.delete(doc.ref);
    });
    await batch1.commit();
    
    // Delete user's analytics data
    const analyticsSnapshot = await db.collection('analytics')
      .where('userId', '==', userId)
      .get();
    
    const batch2 = db.batch();
    analyticsSnapshot.forEach(doc => {
      batch2.delete(doc.ref);
    });
    await batch2.commit();
    
    // Log the completed deletion
    await auditLog(requestedBy, 'USER_DATA_DELETION_COMPLETE', { targetUserId: userId });
    
    return true;
  } catch (error) {
    logger.error(`Error deleting data for user ${userId}:`, error);
    throw error;
  }
}; 