/**
 * Sharing Routes - API endpoints for query sharing
 */

import { Router, Request, Response } from 'express';
import {
  createShare,
  getShare,
  getShareMetadata,
  deleteShare,
  updateShareExpiration,
  getUserShares,
  getSharingStats,
  ExpirationOption
} from '../services/sharingService';

const router = Router();

/**
 * Create a new share
 * POST /api/v1/share
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      queryText,
      queryResult,
      expiration,
      category,
      title,
      description,
      userId
    } = req.body;

    // Validate required fields
    if (!queryText || !queryResult) {
      return res.status(400).json({
        success: false,
        error: 'queryText and queryResult are required'
      });
    }

    // Validate queryResult structure
    if (!queryResult.data || !queryResult.columns) {
      return res.status(400).json({
        success: false,
        error: 'queryResult must include data and columns'
      });
    }

    // Validate expiration option
    const validExpirations: ExpirationOption[] = ['1h', '24h', '7d', '30d', 'never'];
    if (expiration && !validExpirations.includes(expiration)) {
      return res.status(400).json({
        success: false,
        error: `Invalid expiration. Valid options: ${validExpirations.join(', ')}`
      });
    }

    const result = await createShare(queryText, queryResult, {
      expiration,
      category,
      title,
      description,
      createdBy: userId
    });

    if (result.success) {
      return res.status(201).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in share creation:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get a shared query by ID
 * GET /api/v1/share/:shareId
 */
router.get('/:shareId', async (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;

    if (!shareId) {
      return res.status(400).json({
        success: false,
        error: 'Share ID is required'
      });
    }

    const share = await getShare(shareId);

    if (!share) {
      return res.status(404).json({
        success: false,
        error: 'Share not found or expired'
      });
    }

    return res.json({
      success: true,
      share
    });
  } catch (error) {
    console.error('Error retrieving share:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get share metadata (preview without incrementing view count)
 * GET /api/v1/share/:shareId/metadata
 */
router.get('/:shareId/metadata', async (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;

    if (!shareId) {
      return res.status(400).json({
        success: false,
        error: 'Share ID is required'
      });
    }

    const metadata = await getShareMetadata(shareId);

    if (!metadata || !metadata.exists) {
      return res.status(404).json({
        success: false,
        error: 'Share not found or expired'
      });
    }

    return res.json({
      success: true,
      metadata
    });
  } catch (error) {
    console.error('Error retrieving share metadata:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Delete a share
 * DELETE /api/v1/share/:shareId
 */
router.delete('/:shareId', async (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;
    const { userId } = req.body;

    if (!shareId) {
      return res.status(400).json({
        success: false,
        error: 'Share ID is required'
      });
    }

    const deleted = await deleteShare(shareId, userId);

    if (deleted) {
      return res.json({
        success: true,
        message: 'Share deleted successfully'
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Share not found or not authorized'
      });
    }
  } catch (error) {
    console.error('Error deleting share:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update share expiration
 * PATCH /api/v1/share/:shareId/expiration
 */
router.patch('/:shareId/expiration', async (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;
    const { expiration, userId } = req.body;

    if (!shareId || !expiration) {
      return res.status(400).json({
        success: false,
        error: 'Share ID and expiration are required'
      });
    }

    const validExpirations: ExpirationOption[] = ['1h', '24h', '7d', '30d', 'never'];
    if (!validExpirations.includes(expiration)) {
      return res.status(400).json({
        success: false,
        error: `Invalid expiration. Valid options: ${validExpirations.join(', ')}`
      });
    }

    const result = await updateShareExpiration(shareId, expiration, userId);

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(result.error === 'Share not found' ? 404 : 403).json(result);
    }
  } catch (error) {
    console.error('Error updating share expiration:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get user's shares
 * GET /api/v1/share/user/:userId
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const shares = await getUserShares(userId, Math.min(limit, 100));

    return res.json({
      success: true,
      shares,
      count: shares.length
    });
  } catch (error) {
    console.error('Error retrieving user shares:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get sharing statistics
 * GET /api/v1/share/stats
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getSharingStats();
    return res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error retrieving sharing stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export const sharingRoutes = router;
