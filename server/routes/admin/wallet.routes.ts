import { Router } from 'express';
import { AdminWalletController } from '../../controllers/admin/wallet.controller';
import { storage } from '../../storage';
import { db } from '../../db';
import { walletTransactions } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// Get all B2B users with real wallet data
router.get('/', async (req: any, res) => {
  try {
    console.log('Wallet endpoint called, user:', req.user?.username);
    
    // Get all B2B users
    const allUsers = await storage.getAllUsers();
    const b2bUsers = allUsers.filter((user: any) => user.role === 'b2b_user');
    console.log('B2B users found:', b2bUsers.length);
    
    // Calculate real balances for each user
    const walletsData = await Promise.all(
      b2bUsers.map(async (user: any) => {
        // Get all transactions for this user
        const transactions = await db
          .select()
          .from(walletTransactions)
          .where(eq(walletTransactions.userId, user.id))
          .orderBy(desc(walletTransactions.createdAt));

        // Calculate balances from transactions - CORRECT LOGIC: deposits first, then credit
        let depositBalance = 0;
        let creditLimit = 0;
        let creditUsed = 0;

        // First pass: calculate total deposits and credit limit
        transactions.forEach(tx => {
          const amount = parseFloat(tx.amount);
          switch (tx.type) {
            case 'deposit':
              depositBalance += amount;
              break;
            case 'credit_limit':
              creditLimit = amount; // Set to latest credit limit
              break;
          }
        });

        // Second pass: process payments - deduct from deposits first, then use credit
        transactions.forEach(tx => {
          const amount = parseFloat(tx.amount);
          switch (tx.type) {
            case 'payment':
              if (depositBalance >= amount) {
                // Pay from deposits
                depositBalance -= amount;
              } else {
                // Pay from deposits + credit
                const remainingAmount = amount - depositBalance;
                depositBalance = 0;
                creditUsed += remainingAmount;
              }
              break;
            case 'refund':
              // First restore credit, then deposits
              if (creditUsed >= amount) {
                creditUsed -= amount;
              } else {
                const remainingRefund = amount - creditUsed;
                creditUsed = 0;
                depositBalance += remainingRefund;
              }
              break;
          }
        });

        const availableCredit = Math.max(0, creditLimit - creditUsed);
        const totalAvailable = depositBalance + availableCredit;
        const isOverlimit = creditUsed > creditLimit;

        return {
          id: user.id,
          username: user.username,
          firstName: user.firstName || user.first_name,
          lastName: user.lastName || user.last_name,
          email: user.email,
          role: user.role,
          balance: {
            depositBalance: depositBalance.toFixed(2),
            creditLimit: creditLimit.toFixed(2),
            creditUsed: creditUsed.toFixed(2),
            availableCredit: availableCredit.toFixed(2),
            totalAvailable: totalAvailable.toFixed(2),
            isOverlimit
          }
        };
      })
    );
    
    console.log('Returning wallet data with real balances:', walletsData);
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