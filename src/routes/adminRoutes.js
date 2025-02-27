import express from 'express';
import { requirePermission } from '../auth/rbac.js';
import { applyDataRetention, exportUserData, deleteUserData } from '../utils/dataRetention.js';
import { logger, auditLog } from '../utils/logger.js';
import { db } from '../firebase/firebase.js';

const router = express.Router();

// Middleware to ensure admin access
router.use(requirePermission('manage_users'));

// Get all users
router.get('/users', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      // Remove sensitive information
      delete userData.tokens;
      users.push({
        id: doc.id,
        ...userData
      });
    });
    
    // Log the access
    await auditLog(req.user.id, 'ADMIN_USERS_ACCESSED', {
      count: users.length
    });
    
    res.json(users);
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Apply data retention policies
router.post('/data-retention', async (req, res) => {
  try {
    const { orgId } = req.body;
    
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }
    
    const result = await applyDataRetention(orgId);
    
    // Log the action
    await auditLog(req.user.id, 'DATA_RETENTION_APPLIED', {
      orgId,
      success: result
    });
    
    res.json({ success: result });
  } catch (error) {
    logger.error('Error applying data retention:', error);
    res.status(500).json({ error: 'Failed to apply data retention' });
  }
});

// Export user data (GDPR)
router.get('/export-user-data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const userData = await exportUserData(userId);
    
    // Log the export
    await auditLog(req.user.id, 'USER_DATA_EXPORTED', {
      targetUserId: userId
    });
    
    res.json(userData);
  } catch (error) {
    logger.error(`Error exporting user data for ${req.params.userId}:`, error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// Delete user data (GDPR right to be forgotten)
router.delete('/user-data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const result = await deleteUserData(userId, req.user.id);
    
    res.json({ success: result });
  } catch (error) {
    logger.error(`Error deleting user data for ${req.params.userId}:`, error);
    res.status(500).json({ error: 'Failed to delete user data' });
  }
});

// Get audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { userId, action, startDate, endDate, limit } = req.query;
    
    let query = db.collection('audit_logs');
    
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    if (action) {
      query = query.where('action', '==', action);
    }
    
    if (startDate) {
      query = query.where('timestamp', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('timestamp', '<=', endDate);
    }
    
    query = query.orderBy('timestamp', 'desc').limit(parseInt(limit) || 100);
    
    const logsSnapshot = await query.get();
    const logs = [];
    
    logsSnapshot.forEach(doc => {
      logs.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Log the access
    await auditLog(req.user.id, 'AUDIT_LOGS_ACCESSED', {
      count: logs.length,
      filters: { userId, action, startDate, endDate }
    });
    
    res.json(logs);
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router; 