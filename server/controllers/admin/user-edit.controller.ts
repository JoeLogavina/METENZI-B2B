import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { users, userProductPricing, wallets, walletTransactions, orders } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { User, UserProductPricing as UserProductPricingType, Product } from '@shared/schema';

const updateUserProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
  companyDescription: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  vatOrRegistrationNo: z.string().optional(),
});

const updateProductPricingSchema = z.object({
  productId: z.string(),
  customPrice: z.union([z.string(), z.number()]).transform(val => String(val)),
  isVisible: z.boolean(),
});

const walletDepositSchema = z.object({
  amount: z.number().positive(),
});

const creditLimitSchema = z.object({
  creditLimit: z.number().min(0),
});

export class UserEditController {
  // Get user details with all related data
  async getUserDetails(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      const [userResult] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      
      if (!userResult) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ data: userResult });
    } catch (error) {
      console.error('Error fetching user details:', error);
      res.status(500).json({ error: 'Failed to fetch user details' });
    }
  }

  // Update user profile
  async updateUserProfile(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const validatedData = updateUserProfileSchema.parse(req.body);
      
      const [updatedUser] = await db
        .update(users)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ 
        data: updatedUser,
        message: 'User profile updated successfully' 
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ error: 'Failed to update user profile' });
    }
  }

  // Get user's custom product pricing
  async getUserProductPricing(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      const pricingData = await db
        .select({
          id: userProductPricing.id,
          userId: userProductPricing.userId,
          productId: userProductPricing.productId,
          customPrice: userProductPricing.customPrice,
          isVisible: userProductPricing.isVisible,
          createdAt: userProductPricing.createdAt,
          updatedAt: userProductPricing.updatedAt,
        })
        .from(userProductPricing)
        .where(eq(userProductPricing.userId, userId));
      
      res.json({ data: pricingData });
    } catch (error) {
      console.error('Error fetching user product pricing:', error);
      res.status(500).json({ error: 'Failed to fetch product pricing' });
    }
  }

  // Update or create user's custom product pricing
  async updateUserProductPricing(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const validatedData = updateProductPricingSchema.parse(req.body);
      
      // Check if pricing already exists
      const [existingPricing] = await db
        .select()
        .from(userProductPricing)
        .where(
          and(
            eq(userProductPricing.userId, userId),
            eq(userProductPricing.productId, validatedData.productId)
          )
        );
      
      let result;
      if (existingPricing) {
        // Update existing pricing
        [result] = await db
          .update(userProductPricing)
          .set({
            customPrice: validatedData.customPrice,
            isVisible: validatedData.isVisible,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(userProductPricing.userId, userId),
              eq(userProductPricing.productId, validatedData.productId)
            )
          )
          .returning();
      } else {
        // Create new pricing
        [result] = await db
          .insert(userProductPricing)
          .values({
            userId,
            productId: validatedData.productId,
            customPrice: validatedData.customPrice,
            isVisible: validatedData.isVisible,
          })
          .returning();
      }
      
      res.json({ 
        data: result,
        message: 'Product pricing updated successfully' 
      });
    } catch (error) {
      console.error('Error updating product pricing:', error);
      res.status(500).json({ error: 'Failed to update product pricing' });
    }
  }

  // Get user's wallet data
  async getUserWallet(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId));
      
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      // Calculate derived values
      const depositBalance = parseFloat(wallet.depositBalance);
      const creditLimit = parseFloat(wallet.creditLimit);
      const creditUsed = parseFloat(wallet.creditUsed);
      const availableCredit = creditLimit - creditUsed;
      const totalAvailable = depositBalance + availableCredit;
      const isOverlimit = creditUsed > creditLimit;

      const walletWithCalculations = {
        ...wallet,
        depositBalance: wallet.depositBalance,
        creditLimit: wallet.creditLimit,
        creditUsed: wallet.creditUsed,
        availableCredit: availableCredit.toFixed(2),
        totalAvailable: totalAvailable.toFixed(2),
        isOverlimit,
      };
      
      res.json({ data: walletWithCalculations });
    } catch (error) {
      console.error('Error fetching user wallet:', error);
      res.status(500).json({ error: 'Failed to fetch wallet data' });
    }
  }

  // Add deposit to user's wallet
  async addWalletDeposit(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { amount } = walletDepositSchema.parse(req.body);
      const adminId = req.user?.id;
      
      // Get current wallet
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId));
      
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }
      
      const currentBalance = parseFloat(wallet.depositBalance);
      const newBalance = currentBalance + amount;
      
      // Update wallet balance
      const [updatedWallet] = await db
        .update(wallets)
        .set({
          depositBalance: newBalance.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId))
        .returning();
      
      // Create transaction record
      await db
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId,
          type: 'deposit',
          amount: amount.toFixed(2),
          balanceAfter: newBalance.toFixed(2),
          description: `Admin deposit: +€${amount.toFixed(2)}`,
          adminId,
        });
      
      res.json({ 
        data: updatedWallet,
        message: 'Deposit added successfully' 
      });
    } catch (error) {
      console.error('Error adding deposit:', error);
      res.status(500).json({ error: 'Failed to add deposit' });
    }
  }

  // Update user's credit limit
  async updateCreditLimit(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { creditLimit } = creditLimitSchema.parse(req.body);
      const adminId = req.user?.id;
      
      // Get current wallet
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId));
      
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }
      
      const oldCreditLimit = parseFloat(wallet.creditLimit);
      
      // Update credit limit
      const [updatedWallet] = await db
        .update(wallets)
        .set({
          creditLimit: creditLimit.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId))
        .returning();
      
      // Create transaction record
      await db
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId,
          type: 'credit_limit',
          amount: (creditLimit - oldCreditLimit).toFixed(2),
          balanceAfter: wallet.depositBalance,
          description: `Credit limit changed from €${oldCreditLimit.toFixed(2)} to €${creditLimit.toFixed(2)}`,
          adminId,
        });
      
      res.json({ 
        data: updatedWallet,
        message: 'Credit limit updated successfully' 
      });
    } catch (error) {
      console.error('Error updating credit limit:', error);
      res.status(500).json({ error: 'Failed to update credit limit' });
    }
  }

  // Get user's wallet transactions
  async getUserTransactions(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      const transactions = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.userId, userId))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(100); // Limit to last 100 transactions
      
      res.json({ data: transactions });
    } catch (error) {
      console.error('Error fetching user transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  }

  // Get user's payment history (orders)
  async getUserPayments(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      const payments = await db
        .select()
        .from(orders)
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt))
        .limit(50); // Limit to last 50 orders
      
      res.json({ data: payments });
    } catch (error) {
      console.error('Error fetching user payments:', error);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  }
}

export const userEditController = new UserEditController();