import express from 'express';
import { OrderService } from '../../services/order.service';
import { logger } from '../../lib/logger';

const router = express.Router();

// Get all orders for admin dashboard  
router.get('/', async (req, res) => {
  try {
    const adminRole = (req as any).user?.role || 'admin';
    const orderService = new OrderService();
    const allOrders = await orderService.getAllOrders(adminRole);

    logger.info('Admin orders retrieved successfully', {
      category: 'admin',
      orderCount: allOrders.length,
      adminUser: (req as any).user?.email
    });

    res.json(allOrders);
  } catch (error) {
    logger.error('Failed to fetch admin orders', {
      category: 'admin',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminUser: (req as any).user?.email
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;