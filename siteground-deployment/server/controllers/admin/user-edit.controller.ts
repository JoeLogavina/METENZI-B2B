import { Request, Response } from "express";
import { db } from "../../db";
import { users, wallets, walletTransactions, orders, orderItems, userProductPricing, products, licenseKeys } from "../../../shared/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";

// Validation schemas
const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  companyName: z.string().min(1, "Company name is required"),
  contactPerson: z.string().optional(),
  companyDescription: z.string().optional(),
  phone: z.string().min(1, "Phone is required"),
  country: z.string().min(1, "Country is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().min(1, "Address is required"),
  vatOrRegistrationNo: z.string().min(1, "VAT or Registration number is required"),
  isActive: z.boolean().optional()
});

const addDepositSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  description: z.string().optional()
});

const updateCreditLimitSchema = z.object({
  creditLimit: z.number().min(0, "Credit limit must be non-negative")
});

const updatePricingSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  customPrice: z.number().positive("Price must be positive"),
  isVisible: z.boolean()
});

export class UserEditController {
  // Get user details by ID
  static async getUserById(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  }

  // Update user profile
  static async updateProfile(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      // Process user profile update request
      
      const profileData = updateProfileSchema.parse(req.body);
      
      // Profile data parsed successfully

      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Retrieved existing user data for update

      // Update user and return updated data - map camelCase to snake_case for database
      const updateData = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        companyName: profileData.companyName, // maps to company_name
        contactPerson: profileData.contactPerson, // maps to contact_person  
        companyDescription: profileData.companyDescription, // maps to company_description
        phone: profileData.phone,
        country: profileData.country,
        city: profileData.city,
        address: profileData.address,
        vatOrRegistrationNo: profileData.vatOrRegistrationNo, // maps to vat_or_registration_no
        isActive: profileData.isActive,
        updatedAt: new Date()
      };
      
      // Applying user profile updates

      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      // User profile updated successfully

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;

      res.json({ 
        success: true, 
        message: "Profile updated successfully", 
        data: userWithoutPassword 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Validation error occurred
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  }

  // Get user wallet data
  static async getUserWallet(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);

      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }

      // Calculate totals
      const depositBalance = parseFloat(wallet.depositBalance);
      const creditLimit = parseFloat(wallet.creditLimit);
      const creditUsed = parseFloat(wallet.creditUsed);
      const availableCredit = Math.max(0, creditLimit - creditUsed);
      const totalAvailable = depositBalance + availableCredit;
      const isOverlimit = creditUsed > creditLimit;

      const walletData = {
        id: wallet.id,
        userId: wallet.userId,
        tenantId: wallet.tenantId,
        depositBalance: wallet.depositBalance,
        creditLimit: wallet.creditLimit,
        creditUsed: wallet.creditUsed,
        availableCredit: availableCredit.toFixed(2),
        totalAvailable: totalAvailable.toFixed(2),
        isOverlimit,
        isActive: wallet.isActive,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
      };

      res.json({ data: walletData });
    } catch (error) {
      console.error("Error fetching wallet:", error);
      res.status(500).json({ error: "Failed to fetch wallet data" });
    }
  }

  // Add deposit to user wallet
  static async addDeposit(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { amount, description } = addDepositSchema.parse(req.body);
      const adminId = (req.user as any)?.id;

      // Get user wallet
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);

      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }

      // Calculate new balance
      const currentBalance = parseFloat(wallet.depositBalance);
      const newBalance = currentBalance + amount;

      // Update wallet balance
      await db
        .update(wallets)
        .set({
          depositBalance: newBalance.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      // Record transaction
      await db.insert(walletTransactions).values({
        walletId: wallet.id,
        userId: userId,
        type: "deposit",
        amount: amount.toString(),
        balanceAfter: newBalance.toFixed(2),
        description: description || `Deposit added by admin`,
        adminId: adminId
      });

      res.json({ success: true, message: "Deposit added successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error adding deposit:", error);
      res.status(500).json({ error: "Failed to add deposit" });
    }
  }

  // Update credit limit
  static async updateCreditLimit(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { creditLimit } = updateCreditLimitSchema.parse(req.body);
      const adminId = (req.user as any)?.id;

      // Get user wallet
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);

      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }

      const oldCreditLimit = parseFloat(wallet.creditLimit);

      // Update credit limit
      await db
        .update(wallets)
        .set({
          creditLimit: creditLimit.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      // Record transaction for credit limit change
      await db.insert(walletTransactions).values({
        walletId: wallet.id,
        userId: userId,
        type: "credit_limit",
        amount: (creditLimit - oldCreditLimit).toString(),
        balanceAfter: wallet.depositBalance,
        description: `Credit limit changed from €${oldCreditLimit.toFixed(2)} to €${creditLimit.toFixed(2)}`,
        adminId: adminId
      });

      res.json({ success: true, message: "Credit limit updated successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating credit limit:", error);
      res.status(500).json({ error: "Failed to update credit limit" });
    }
  }

  // Get user's custom pricing
  static async getUserPricing(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const userPricing = await db
        .select()
        .from(userProductPricing)
        .where(eq(userProductPricing.userId, userId))
        .orderBy(desc(userProductPricing.createdAt));

      res.json(userPricing);
    } catch (error) {
      console.error("Error fetching user pricing:", error);
      res.status(500).json({ error: "Failed to fetch user pricing" });
    }
  }

  // Update product pricing for user
  static async updateProductPricing(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { productId, customPrice, isVisible } = updatePricingSchema.parse(req.body);

      // Check if pricing record exists
      const [existingPricing] = await db
        .select()
        .from(userProductPricing)
        .where(
          and(
            eq(userProductPricing.userId, userId),
            eq(userProductPricing.productId, productId)
          )
        )
        .limit(1);

      if (existingPricing) {
        // Update existing pricing
        await db
          .update(userProductPricing)
          .set({
            customPrice: customPrice.toString(),
            isVisible,
            updatedAt: new Date()
          })
          .where(eq(userProductPricing.id, existingPricing.id));
      } else {
        // Insert new pricing
        await db.insert(userProductPricing).values({
          userId,
          productId,
          customPrice: customPrice.toString(),
          isVisible
        });
      }

      res.json({ success: true, message: "Product pricing updated successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating product pricing:", error);
      res.status(500).json({ error: "Failed to update product pricing" });
    }
  }

  // Get transaction history for user
  static async getTransactionHistory(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const transactions = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.userId, userId))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(100);

      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transaction history:", error);
      res.status(500).json({ error: "Failed to fetch transaction history" });
    }
  }

  // Delete product pricing for user
  static async deleteProductPricing(req: Request, res: Response) {
    try {
      const { userId, productId } = req.params;

      // Delete the pricing record
      const result = await db
        .delete(userProductPricing)
        .where(
          and(
            eq(userProductPricing.userId, userId),
            eq(userProductPricing.productId, productId)
          )
        );

      res.json({ success: true, message: "Product removed from user successfully" });
    } catch (error) {
      console.error("Error deleting product pricing:", error);
      res.status(500).json({ error: "Failed to remove product from user" });
    }
  }

  // Delete multiple product pricing for user
  static async deleteMultipleProductPricing(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { productIds } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: "productIds must be a non-empty array" });
      }

      // Delete the pricing records
      const result = await db
        .delete(userProductPricing)
        .where(
          and(
            eq(userProductPricing.userId, userId),
            inArray(userProductPricing.productId, productIds)
          )
        );

      res.json({ success: true, message: `${productIds.length} products removed from user successfully` });
    } catch (error) {
      console.error("Error deleting multiple product pricing:", error);
      res.status(500).json({ error: "Failed to remove products from user" });
    }
  }

  // Get payment history for user (orders with wallet payments)
  static async getPaymentHistory(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const payments = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          finalAmount: orders.finalAmount,
          paymentMethod: orders.paymentMethod,
          paymentStatus: orders.paymentStatus,
          createdAt: orders.createdAt
        })
        .from(orders)
        .where(
          and(
            eq(orders.userId, userId),
            eq(orders.paymentMethod, "wallet"),
            eq(orders.paymentStatus, "paid")
          )
        )
        .orderBy(desc(orders.createdAt))
        .limit(100);

      // Format the response to match expected structure
      const formattedPayments = payments.map((payment: any) => ({
        id: payment.id,
        orderId: payment.id,
        orderNumber: payment.orderNumber,
        amount: payment.finalAmount,
        paymentMethod: payment.paymentMethod,
        paymentStatus: payment.paymentStatus,
        createdAt: payment.createdAt
      }));

      res.json(formattedPayments);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ error: "Failed to fetch payment history" });
    }
  }
}