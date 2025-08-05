import { Request, Response } from 'express';
import { WalletService } from '../../services/wallet.service';

export class AdminWalletController {
  /**
   * Get all B2B users with their wallet information using enterprise wallet service
   */
  static async getAllWallets(req: Request, res: Response): Promise<void> {
    try {
      const walletService = new WalletService();
      const userRole = (req as any).user?.role || 'admin';
      
      // Get all wallets (cross-tenant view for admins)
      const walletsData = await walletService.getAllWallets(userRole);
      
      console.log('Final wallets data:', walletsData);
      res.json(walletsData);
    } catch (error: any) {
      console.error('Error fetching wallets:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get transactions for a specific user
   */
  static async getUserTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const adminUserId = (req.user as any).id;
      
      if (!userId) {
        res.status(400).json({ message: 'User ID is required' });
        return;
      }

      const walletService = new WalletService();
      
      // Get user to determine tenant
      const { storage } = await import('../../storage');
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      if (user.role !== 'b2b_user') {
        res.status(403).json({ message: 'Can only view transactions for B2B users' });
        return;
      }

      const transactions = await walletService.getWalletTransactions(userId, user.tenantId);
      
      res.json(transactions);
    } catch (error: any) {
      console.error('Error fetching user transactions:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Add a transaction to a user's wallet
   */
  static async addTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { userId, type, amount, description } = req.body;
      const adminUserId = (req.user as any).id;
      const adminUsername = (req.user as any).username;

      if (!userId || !type || !amount) {
        res.status(400).json({ message: 'User ID, transaction type, and amount are required' });
        return;
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        res.status(400).json({ message: 'Amount must be a positive number' });
        return;
      }

      const walletService = new WalletService();
      const { storage } = await import('../../storage');
      
      // Verify user exists and is B2B user
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      if (user.role !== 'b2b_user') {
        res.status(403).json({ message: 'Can only manage wallets for B2B users' });
        return;
      }

      // Validate transaction type
      const validTypes = ['deposit', 'credit_limit', 'credit_payment', 'adjustment', 'refund'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ message: 'Invalid transaction type' });
        return;
      }

      const finalDescription = description || `${type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')} by admin ${adminUsername}`;

      // Support all transaction types including credit limit
      let result;
      switch (type) {
        case 'deposit':
        case 'adjustment':
        case 'refund':
          result = await walletService.addFunds(userId, user.tenantId, amountNum, adminUserId, finalDescription);
          break;
        case 'credit_limit':
          result = await walletService.setCreditLimit(userId, user.tenantId, amountNum, adminUserId, finalDescription);
          break;
        case 'credit_payment':
          result = await walletService.addFunds(userId, user.tenantId, amountNum, adminUserId, finalDescription);
          break;
        default:
          res.status(400).json({ message: 'Transaction type not yet supported in enterprise wallet system' });
          return;
      }

      if (!result.success) {
        res.status(400).json({ message: result.error || 'Transaction failed' });
        return;
      }
      
      res.status(201).json({
        message: 'Transaction added successfully',
        newBalance: result.newBalance
      });
    } catch (error: any) {
      console.error('Error adding transaction:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get wallet analytics and summary data
   */
  static async getWalletAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const walletService = new WalletService();
      const userRole = (req as any).user?.role || 'admin';
      
      // Get all wallets using enterprise service
      const allWallets = await walletService.getAllWallets(userRole);
      
      let totalDeposits = 0;
      let totalCreditLimit = 0;
      let totalCreditUsed = 0;
      let usersOverLimit = 0;
      
      for (const wallet of allWallets) {
        totalDeposits += parseFloat(wallet.balance.depositBalance);
        totalCreditLimit += parseFloat(wallet.balance.creditLimit);
        totalCreditUsed += parseFloat(wallet.balance.creditUsed);
        if (wallet.balance.isOverlimit) {
          usersOverLimit++;
        }
      }

      const analytics = {
        totalUsers: allWallets.length,
        totalDeposits: totalDeposits.toFixed(2),
        totalCreditLimit: totalCreditLimit.toFixed(2),
        totalCreditUsed: totalCreditUsed.toFixed(2),  
        usersOverLimit,
        averageBalance: allWallets.length > 0 ? (totalDeposits / allWallets.length).toFixed(2) : "0"
      };
      
      res.json(analytics);
    } catch (error: any) {
      console.error('Error fetching wallet analytics:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}