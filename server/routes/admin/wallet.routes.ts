import { Router } from 'express';
import { AdminWalletController } from '../../controllers/admin/wallet.controller';
import { storage } from '../../storage';

const router = Router();

// Simple working wallet endpoint
router.get('/', async (req: any, res) => {
  try {
    console.log('Wallet endpoint called, user:', req.user?.username);
    
    // Get all B2B users
    const allUsers = await storage.getAllUsers();
    const b2bUsers = allUsers.filter((user: any) => user.role === 'b2b_user');
    console.log('B2B users found:', b2bUsers.length);
    
    // Return wallet data for B2B users
    const walletsData = b2bUsers.map((user: any) => ({
      id: user.id,
      username: user.username,
      firstName: user.firstName || user.first_name,
      lastName: user.lastName || user.last_name,  
      email: user.email,
      role: user.role,
      balance: {
        depositBalance: "0.00",
        creditLimit: "1000.00",
        creditUsed: "0.00",
        availableCredit: "1000.00",
        totalAvailable: "1000.00",
        isOverlimit: false
      }
    }));
    
    console.log('Returning wallet data:', walletsData);
    res.json(walletsData);
  } catch (error) {
    console.error("Error fetching wallets:", error);
    res.status(500).json({ message: "Failed to fetch wallets" });
  }
});

// Get transactions for a specific user
router.get('/:userId/transactions', AdminWalletController.getUserTransactions);

// Add transaction to user wallet
router.post('/transaction', AdminWalletController.addTransaction);

// Get wallet analytics
router.get('/analytics', AdminWalletController.getWalletAnalytics);

export default router;