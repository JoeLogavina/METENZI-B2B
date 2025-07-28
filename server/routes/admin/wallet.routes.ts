import { Router } from 'express';
import { AdminWalletController } from '../../controllers/admin/wallet.controller';
import { storage } from '../../storage';
import { db } from '../../db';
import { walletTransactions } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// Get all B2B users with real wallet data using proper controller
router.get('/', AdminWalletController.getAllWallets);

// Get transactions for a specific user
router.get('/:userId/transactions', AdminWalletController.getUserTransactions);

// Add transaction to user wallet
router.post('/transaction', AdminWalletController.addTransaction);

// Get wallet analytics
router.get('/analytics', AdminWalletController.getWalletAnalytics);

export default router;