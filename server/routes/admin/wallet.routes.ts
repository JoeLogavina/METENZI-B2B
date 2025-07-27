import { Router } from 'express';
import { AdminWalletController } from '../../controllers/admin/wallet.controller';

const router = Router();

// Get all B2B user wallets
router.get('/wallets', AdminWalletController.getAllWallets);

// Get transactions for a specific user
router.get('/wallets/:userId/transactions', AdminWalletController.getUserTransactions);

// Add transaction to user wallet
router.post('/wallets/transaction', AdminWalletController.addTransaction);

// Get wallet analytics
router.get('/wallets/analytics', AdminWalletController.getWalletAnalytics);

export default router;