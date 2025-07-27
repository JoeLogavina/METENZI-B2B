import { Request, Response } from 'express';
import { walletService } from '../../services/wallet.service';
import { storage } from '../../storage';

export class AdminWalletController {
  /**
   * Get all B2B users with their wallet information
   */
  static async getAllWallets(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as any).id;
      
      // Get all B2B users
      const allUsers = await storage.getAllUsers();
      const b2bUsers = allUsers.filter(user => user.role === 'b2b_user');
      
      // Get wallet information for each user
      const walletsData = await Promise.all(
        b2bUsers.map(async (user: any) => {
          const walletData = await walletService.getWalletSummary(user.id);
          return {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            balance: walletData?.balance || {
              depositBalance: "0",
              creditLimit: "0",
              creditUsed: "0",
              availableCredit: "0",
              totalAvailable: "0",
              isOverlimit: false
            }
          };
        })
      );
      
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

      // Verify user exists and is B2B user
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      if (user.role !== 'b2b_user') {
        res.status(403).json({ message: 'Can only view transactions for B2B users' });
        return;
      }

      const walletData = await walletService.getWalletSummary(userId);
      const transactions = walletData?.recentTransactions || [];
      
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

      let transaction;
      const finalDescription = description || `${type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')} by admin ${adminUsername}`;

      switch (type) {
        case 'deposit':
          transaction = await walletService.addDeposit(userId, amountNum.toString(), finalDescription, adminUserId);
          break;
        case 'credit_limit':
          transaction = await walletService.setCreditLimit(userId, amountNum.toString(), adminUserId);
          break;
        case 'credit_payment':
          transaction = await walletService.recordCreditPayment(userId, amountNum.toString(), finalDescription, adminUserId);
          break;
        case 'adjustment':
          // adjustBalance method doesn't exist yet, let's use addDeposit for now
          transaction = await walletService.addDeposit(userId, amountNum.toString(), finalDescription, adminUserId);
          break;
        case 'refund':
          transaction = await walletService.addDeposit(userId, amountNum.toString(), finalDescription, adminUserId);
          break;
        default:
          res.status(400).json({ message: 'Unsupported transaction type' });
          return;
      }
      
      res.status(201).json({
        message: 'Transaction added successfully',
        transaction
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
      const adminUserId = (req.user as any).id;
      
      // Get all B2B users
      const allUsers = await storage.getAllUsers();
      const b2bUsers = allUsers.filter(user => user.role === 'b2b_user');
      
      let totalDeposits = 0;
      let totalCreditLimit = 0;
      let totalCreditUsed = 0;
      let usersOverLimit = 0;
      
      for (const user of b2bUsers) {
        const walletData = await walletService.getWalletSummary(user.id);
        if (walletData?.balance) {
          totalDeposits += parseFloat(walletData.balance.depositBalance);
          totalCreditLimit += parseFloat(walletData.balance.creditLimit);
          totalCreditUsed += parseFloat(walletData.balance.creditUsed);
          if (walletData.balance.isOverlimit) {
            usersOverLimit++;
          }
        }
      }

      const analytics = {
        totalUsers: b2bUsers.length,
        totalDeposits: totalDeposits.toFixed(2),
        totalCreditLimit: totalCreditLimit.toFixed(2),
        totalCreditUsed: totalCreditUsed.toFixed(2),
        usersOverLimit,
        averageBalance: b2bUsers.length > 0 ? (totalDeposits / b2bUsers.length).toFixed(2) : "0"
      };
      
      res.json(analytics);
    } catch (error: any) {
      console.error('Error fetching wallet analytics:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}