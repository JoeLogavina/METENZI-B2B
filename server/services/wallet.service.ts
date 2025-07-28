import { db } from '../db';
import { wallets, walletTransactions, orders, users } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface WalletBalance {
  depositBalance: string;
  creditLimit: string;
  creditUsed: string;
  availableCredit: string;
  totalAvailable: string;
  isOverlimit: boolean;
}

export interface WalletData {
  id: string;
  userId: string;
  tenantId: string;
  depositBalance: string;
  creditLimit: string;
  creditUsed: string;
  isActive: boolean;
  balance: WalletBalance;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: string;
  description: string;
  createdAt: string;
  balanceAfter: string;
  orderId?: string;
}

export class WalletService {
  private static tenantContextCache = new Map<string, { tenantId: string; userRole: string; setAt: number }>();
  private static CONTEXT_CACHE_TTL = 60000; // 1 minute

  /**
   * Set tenant context for RLS policies with caching optimization
   */
  private async setTenantContext(tenantId: string, userRole: string = 'b2b_user'): Promise<void> {
    const cacheKey = `${tenantId}:${userRole}`;
    const cached = WalletService.tenantContextCache.get(cacheKey);
    
    // Skip database call if context was recently set
    if (cached && (Date.now() - cached.setAt) < WalletService.CONTEXT_CACHE_TTL) {
      return;
    }

    await db.execute(sql`SELECT set_tenant_context(${tenantId}, ${userRole})`);
    
    // Cache the context setting
    WalletService.tenantContextCache.set(cacheKey, {
      tenantId,
      userRole,
      setAt: Date.now()
    });
  }

  /**
   * Initialize wallet for user if it doesn't exist
   */
  async initializeWallet(userId: string, tenantId: string): Promise<string> {
    await this.setTenantContext(tenantId);
    
    // Check if wallet exists
    const [existingWallet] = await db
      .select({ id: wallets.id })
      .from(wallets)
      .where(and(
        eq(wallets.userId, userId),
        eq(wallets.tenantId, tenantId)
      ));

    if (existingWallet) {
      return existingWallet.id;
    }

    // Create wallet using stored procedure
    const result = await db.execute(
      sql`SELECT initialize_user_wallet(${userId}, ${tenantId}, 5000.00, 5000.00) as wallet_id`
    );
    
    return result.rows[0]?.wallet_id as string;
  }

  /**
   * Get wallet data with proper tenant isolation
   */
  async getWallet(userId: string, tenantId: string): Promise<WalletData> {
    await this.setTenantContext(tenantId);
    
    // Initialize wallet if it doesn't exist
    await this.initializeWallet(userId, tenantId);

    // Get wallet record (RLS will automatically filter by tenant)
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(and(
        eq(wallets.userId, userId),
        eq(wallets.tenantId, tenantId)
      ));

    if (!wallet) {
      throw new Error('Wallet not found after initialization');
    }

    const depositBalance = parseFloat(wallet.depositBalance);
    const creditLimit = parseFloat(wallet.creditLimit);
    const creditUsed = parseFloat(wallet.creditUsed);
    const availableCredit = Math.max(0, creditLimit - creditUsed);
    const totalAvailable = depositBalance + availableCredit;
    const isOverlimit = creditUsed > creditLimit;

    return {
      id: wallet.id,
      userId: wallet.userId,
      tenantId: wallet.tenantId,
      depositBalance: depositBalance.toFixed(2),
      creditLimit: creditLimit.toFixed(2),
      creditUsed: creditUsed.toFixed(2),
      isActive: wallet.isActive,
      balance: {
        depositBalance: depositBalance.toFixed(2),
        creditLimit: creditLimit.toFixed(2),
        creditUsed: creditUsed.toFixed(2),
        availableCredit: availableCredit.toFixed(2),
        totalAvailable: totalAvailable.toFixed(2),
        isOverlimit
      }
    };
  }

  /**
   * Get wallet transactions with proper tenant isolation
   */
  async getWalletTransactions(userId: string, tenantId: string): Promise<WalletTransaction[]> {
    await this.setTenantContext(tenantId);
    
    // Get wallet ID
    const [wallet] = await db
      .select({ id: wallets.id })
      .from(wallets)
      .where(and(
        eq(wallets.userId, userId),
        eq(wallets.tenantId, tenantId)
      ));

    if (!wallet) {
      return [];
    }

    // Get transactions (RLS will automatically filter)
    const transactions = await db
      .select({
        id: walletTransactions.id,
        type: walletTransactions.type,
        amount: walletTransactions.amount,
        description: walletTransactions.description,
        createdAt: walletTransactions.createdAt,
        balanceAfter: walletTransactions.balanceAfter,
        orderId: walletTransactions.orderId
      })
      .from(walletTransactions)
      .where(eq(walletTransactions.walletId, wallet.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(50);

    return transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description || '',
      createdAt: tx.createdAt?.toISOString() || new Date().toISOString(),
      balanceAfter: tx.balanceAfter,
      orderId: tx.orderId || undefined
    }));
  }

  /**
   * Process payment from wallet (called during order creation)
   */
  async processPayment(
    userId: string, 
    tenantId: string, 
    amount: number, 
    orderId: string,
    description: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    await this.setTenantContext(tenantId);

    return await db.transaction(async (tx) => {
      // Get current wallet
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(and(
          eq(wallets.userId, userId),
          eq(wallets.tenantId, tenantId)
        ));

      if (!wallet) {
        return { success: false, newBalance: 0, error: 'Wallet not found' };
      }

      const currentDeposit = parseFloat(wallet.depositBalance);
      const currentCreditUsed = parseFloat(wallet.creditUsed);
      const creditLimit = parseFloat(wallet.creditLimit);
      const totalAvailable = currentDeposit + (creditLimit - currentCreditUsed);

      if (amount > totalAvailable) {
        return { success: false, newBalance: currentDeposit, error: 'Insufficient funds' };
      }

      // Calculate new balances
      let newDepositBalance = currentDeposit;
      let newCreditUsed = currentCreditUsed;

      if (amount <= currentDeposit) {
        // Use deposit balance first
        newDepositBalance = currentDeposit - amount;
      } else {
        // Use all deposit + credit
        const creditNeeded = amount - currentDeposit;
        newDepositBalance = 0;
        newCreditUsed = currentCreditUsed + creditNeeded;
      }

      // Update wallet
      await tx
        .update(wallets)
        .set({
          depositBalance: newDepositBalance.toFixed(2),
          creditUsed: newCreditUsed.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      // Create transaction record
      await tx
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId: userId,
          type: 'payment',
          amount: `-${amount.toFixed(2)}`,
          balanceAfter: newDepositBalance.toFixed(2),
          description: description,
          orderId: orderId
        });

      return { 
        success: true, 
        newBalance: newDepositBalance,
        error: undefined 
      };
    });
  }

  /**
   * Add funds to wallet (admin operation)
   */
  async addFunds(
    userId: string,
    tenantId: string,
    amount: number,
    adminId: string,
    description: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    await this.setTenantContext(tenantId, 'admin');

    return await db.transaction(async (tx) => {
      // Get wallet
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(and(
          eq(wallets.userId, userId),
          eq(wallets.tenantId, tenantId)
        ));

      if (!wallet) {
        return { success: false, newBalance: 0, error: 'Wallet not found' };
      }

      const currentBalance = parseFloat(wallet.depositBalance);
      const newBalance = currentBalance + amount;

      // Update wallet
      await tx
        .update(wallets)
        .set({
          depositBalance: newBalance.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      // Create transaction record
      await tx
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId: userId,
          type: 'deposit',
          amount: `+${amount.toFixed(2)}`,
          balanceAfter: newBalance.toFixed(2),
          description: description,
          adminId: adminId
        });

      return { success: true, newBalance, error: undefined };
    });
  }

  /**
   * Get all wallets for admin (cross-tenant view)
   */
  async getAllWallets(adminRole: string): Promise<WalletData[]> {
    await this.setTenantContext('admin', adminRole);

    const allWallets = await db
      .select({
        id: wallets.id,
        userId: wallets.userId,
        tenantId: wallets.tenantId,
        depositBalance: wallets.depositBalance,
        creditLimit: wallets.creditLimit,
        creditUsed: wallets.creditUsed,
        isActive: wallets.isActive,
        username: users.username,
        email: users.email
      })
      .from(wallets)
      .innerJoin(users, eq(wallets.userId, users.id))
      .orderBy(wallets.tenantId, wallets.createdAt);

    return allWallets.map(wallet => {
      const depositBalance = parseFloat(wallet.depositBalance);
      const creditLimit = parseFloat(wallet.creditLimit);
      const creditUsed = parseFloat(wallet.creditUsed);
      const availableCredit = Math.max(0, creditLimit - creditUsed);
      const totalAvailable = depositBalance + availableCredit;
      const isOverlimit = creditUsed > creditLimit;

      return {
        id: wallet.id,
        userId: wallet.userId,
        tenantId: wallet.tenantId,
        depositBalance: depositBalance.toFixed(2),
        creditLimit: creditLimit.toFixed(2),
        creditUsed: creditUsed.toFixed(2),
        isActive: wallet.isActive,
        balance: {
          depositBalance: depositBalance.toFixed(2),
          creditLimit: creditLimit.toFixed(2),
          creditUsed: creditUsed.toFixed(2),
          availableCredit: availableCredit.toFixed(2),
          totalAvailable: totalAvailable.toFixed(2),
          isOverlimit
        }
      };
    });
  }
}

// Export singleton instance for backward compatibility
export const walletService = new WalletService();