import { db } from "../db";
import { wallets, walletTransactions, users, type Wallet, type WalletTransaction, type InsertWallet, type InsertWalletTransaction } from "@shared/schema";
import { eq, and, desc, sum } from "drizzle-orm";
class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export interface WalletBalance {
  depositBalance: string;
  creditLimit: string;
  creditUsed: string;
  availableCredit: string;
  totalAvailable: string;
  isOverlimit: boolean;
}

export interface WalletSummary extends Wallet {
  balance: WalletBalance;
  recentTransactions: WalletTransaction[];
}

class WalletServiceImpl {
  async getOrCreateUserWallet(userId: string): Promise<Wallet> {
    try {
      // Check if wallet exists
      const [existingWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId));

      if (existingWallet) {
        return existingWallet;
      }

      // Create new wallet for user
      const [newWallet] = await db
        .insert(wallets)
        .values({
          userId,
          depositBalance: "0.00",
          creditLimit: "0.00",
          creditUsed: "0.00",
          isActive: true,
        })
        .returning();

      return newWallet;
    } catch (error) {
      console.error("Error getting or creating wallet:", error);
      throw new ServiceError("Failed to access user wallet");
    }
  }

  async getWalletSummary(userId: string): Promise<WalletSummary> {
    try {
      const wallet = await this.getOrCreateUserWallet(userId);
      
      // Get all transactions for this user to calculate real balance
      const transactions = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.userId, userId))
        .orderBy(desc(walletTransactions.createdAt));

      // Calculate real balance from transactions
      const balance = this.calculateBalanceFromTransactions(transactions);

      // Get recent transactions (limit to 10 for display)
      const recentTransactions = transactions.slice(0, 10);

      return {
        ...wallet,
        balance,
        recentTransactions,
      };
    } catch (error) {
      console.error("Error getting wallet summary:", error);
      throw new ServiceError("Failed to get wallet summary");
    }
  }

  async addDeposit(userId: string, amount: string, description: string, adminId: string): Promise<WalletTransaction> {
    try {
      const wallet = await this.getOrCreateUserWallet(userId);
      const depositAmount = parseFloat(amount);
      
      if (depositAmount <= 0) {
        throw new ServiceError("Deposit amount must be greater than 0");
      }

      const newDepositBalance = (parseFloat(wallet.depositBalance) + depositAmount).toFixed(2);

      // Update wallet deposit balance
      await db
        .update(wallets)
        .set({ 
          depositBalance: newDepositBalance,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      // Record transaction
      const [transaction] = await db
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId,
          type: "deposit",
          amount: amount,
          balanceAfter: newDepositBalance,
          description,
          adminId,
        })
        .returning();

      return transaction;
    } catch (error) {
      console.error("Error adding deposit:", error);
      throw new ServiceError("Failed to add deposit to wallet");
    }
  }

  async setCreditLimit(userId: string, creditLimit: string, adminId: string): Promise<WalletTransaction> {
    try {
      const wallet = await this.getOrCreateUserWallet(userId);
      const newCreditLimit = parseFloat(creditLimit);
      
      if (newCreditLimit < 0) {
        throw new ServiceError("Credit limit cannot be negative");
      }

      // Update wallet credit limit
      await db
        .update(wallets)
        .set({ 
          creditLimit: creditLimit,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      // Record transaction
      const [transaction] = await db
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId,
          type: "credit_limit",
          amount: creditLimit,
          balanceAfter: wallet.depositBalance, // Deposit balance doesn't change
          description: `Credit limit set to €${creditLimit}`,
          adminId,
        })
        .returning();

      return transaction;
    } catch (error) {
      console.error("Error setting credit limit:", error);
      throw new ServiceError("Failed to set credit limit");
    }
  }

  async recordCreditPayment(userId: string, amount: string, description: string, adminId: string): Promise<WalletTransaction> {
    try {
      const wallet = await this.getOrCreateUserWallet(userId);
      const paymentAmount = parseFloat(amount);
      
      if (paymentAmount <= 0) {
        throw new ServiceError("Payment amount must be greater than 0");
      }

      const currentCreditUsed = parseFloat(wallet.creditUsed);
      const newCreditUsed = Math.max(0, currentCreditUsed - paymentAmount).toFixed(2);

      // Update wallet credit used
      await db
        .update(wallets)
        .set({ 
          creditUsed: newCreditUsed,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      // Record transaction
      const [transaction] = await db
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId,
          type: "credit_payment",
          amount: amount,
          balanceAfter: wallet.depositBalance, // Deposit balance doesn't change
          description: description || `Credit payment of €${amount}`,
          adminId,
        })
        .returning();

      return transaction;
    } catch (error) {
      console.error("Error recording credit payment:", error);
      throw new ServiceError("Failed to record credit payment");
    }
  }

  async processPayment(userId: string, amount: string, orderId: string, description: string): Promise<{ success: boolean; paymentMethod: string; transaction?: WalletTransaction }> {
    try {
      const wallet = await this.getOrCreateUserWallet(userId);
      const paymentAmount = parseFloat(amount);
      
      if (paymentAmount <= 0) {
        throw new ServiceError("Payment amount must be greater than 0");
      }

      const balance = this.calculateBalance(wallet);
      const totalAvailable = parseFloat(balance.totalAvailable);

      if (totalAvailable < paymentAmount) {
        return {
          success: false,
          paymentMethod: "insufficient_funds",
        };
      }

      let newDepositBalance = parseFloat(wallet.depositBalance);
      let newCreditUsed = parseFloat(wallet.creditUsed);
      let paymentMethod = "";

      // First use deposit balance
      if (newDepositBalance >= paymentAmount) {
        newDepositBalance -= paymentAmount;
        paymentMethod = "deposit";
      } else {
        // Use deposit + credit
        const remainingAmount = paymentAmount - newDepositBalance;
        newDepositBalance = 0;
        newCreditUsed += remainingAmount;
        paymentMethod = newDepositBalance > 0 ? "deposit_and_credit" : "credit";
      }

      // Update wallet
      await db
        .update(wallets)
        .set({ 
          depositBalance: newDepositBalance.toFixed(2),
          creditUsed: newCreditUsed.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      // Record transaction
      const [transaction] = await db
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId,
          type: "payment",
          amount: amount,
          balanceAfter: newDepositBalance.toFixed(2),
          description: description || `Payment for order ${orderId}`,
          orderId,
        })
        .returning();

      return {
        success: true,
        paymentMethod,
        transaction,
      };
    } catch (error) {
      console.error("Error processing payment:", error);
      throw new ServiceError("Failed to process wallet payment");
    }
  }

  async getTransactionHistory(userId: string, limit: number = 50): Promise<WalletTransaction[]> {
    try {
      const wallet = await this.getOrCreateUserWallet(userId);
      
      return await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.walletId, wallet.id))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(limit);
    } catch (error) {
      console.error("Error getting transaction history:", error);
      throw new ServiceError("Failed to get transaction history");
    }
  }

  private calculateBalance(wallet: Wallet): WalletBalance {
    const depositBalance = parseFloat(wallet.depositBalance);
    const creditLimit = parseFloat(wallet.creditLimit);
    const creditUsed = parseFloat(wallet.creditUsed);
    
    const availableCredit = Math.max(0, creditLimit - creditUsed);
    const totalAvailable = depositBalance + availableCredit;
    const isOverlimit = creditUsed > creditLimit;

    return {
      depositBalance: depositBalance.toFixed(2),
      creditLimit: creditLimit.toFixed(2),
      creditUsed: creditUsed.toFixed(2),
      availableCredit: availableCredit.toFixed(2),
      totalAvailable: totalAvailable.toFixed(2),
      isOverlimit,
    };
  }



  async getAllWalletsSummary(): Promise<Array<WalletSummary & { user: { username: string; email: string } }>> {
    try {
      const walletsWithUsers = await db
        .select({
          wallet: wallets,
          user: {
            id: users.id,
            username: users.username,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(wallets)
        .leftJoin(users, eq(wallets.userId, users.id))
        .where(eq(wallets.isActive, true));

      const results = [];
      for (const { wallet, user } of walletsWithUsers) {
        const recentTransactions = await db
          .select()
          .from(walletTransactions)
          .where(eq(walletTransactions.walletId, wallet.id))
          .orderBy(desc(walletTransactions.createdAt))
          .limit(5);

        const balance = this.calculateBalance(wallet);

        results.push({
          ...wallet,
          balance,
          recentTransactions,
          user: { 
            username: user?.username || "Unknown", 
            email: user?.email || "Unknown" 
          },
        } as any);
      }

      return results;
    } catch (error) {
      console.error("Error getting all wallets summary:", error);
      throw new ServiceError("Failed to get wallets summary");
    }
  }
  // Method to calculate balance from transactions
  private calculateBalanceFromTransactions(transactions: WalletTransaction[]): WalletBalance {
    let depositBalance = 0;
    let creditLimit = 0;
    let creditUsed = 0;

    transactions.forEach(tx => {
      const amount = parseFloat(tx.amount);
      switch (tx.type) {
        case 'deposit':
          depositBalance += amount;
          break;
        case 'credit_limit':
          creditLimit = amount; // Set to latest credit limit
          break;
        case 'payment':
          creditUsed += amount;
          break;
        case 'refund':
          creditUsed = Math.max(0, creditUsed - amount);
          break;
      }
    });

    const availableCredit = Math.max(0, creditLimit - creditUsed);
    const totalAvailable = depositBalance + availableCredit;
    const isOverlimit = creditUsed > creditLimit;

    return {
      depositBalance: depositBalance.toFixed(2),
      creditLimit: creditLimit.toFixed(2),
      creditUsed: creditUsed.toFixed(2),
      availableCredit: availableCredit.toFixed(2),
      totalAvailable: totalAvailable.toFixed(2),
      isOverlimit
    };
  }
}

export const walletService = new WalletServiceImpl();