import { Router } from 'express';
import { storage } from '../storage';
import { authenticate, authorize, Permissions } from '../middleware/auth.middleware';

const router = Router();

// Get detailed license keys for admin management
router.get('/license-keys', authenticate, authorize(Permissions.REPORT_READ), async (req, res) => {
  try {
    const { search, orderNumber, category, buyer, startDate, endDate } = req.query;
    
    const filters = {
      search: search as string,
      orderNumber: orderNumber as string,
      category: category as string,
      buyer: buyer as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof typeof filters] === undefined) {
        delete filters[key as keyof typeof filters];
      }
    });

    const licenseKeys = await storage.getDetailedLicenseKeys(filters);
    
    res.json({
      success: true,
      data: licenseKeys,
      count: licenseKeys.length
    });
  } catch (error) {
    console.error('Error fetching license keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch license keys'
    });
  }
});

export { router as default };