import { Router } from 'express';

const router = Router();

// GET /api/v1/users/profile
router.get('/profile', async (req, res) => {
  res.json({ 
    message: 'User profile endpoint - to be implemented' 
  });
});

// PUT /api/v1/users/profile
router.put('/profile', async (req, res) => {
  res.json({ 
    message: 'Update profile endpoint - to be implemented' 
  });
});

// GET /api/v1/users/subscription
router.get('/subscription', async (req, res) => {
  res.json({ 
    message: 'Subscription status endpoint - to be implemented' 
  });
});

export { router as userRoutes };