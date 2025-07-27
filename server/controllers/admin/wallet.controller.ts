import { Request, Response } from "express";
import { walletService } from "../../services/wallet.service";
import { z } from "zod";

// Validation schemas
const addDepositSchema = z.object({
  userId: z.string(),
  amount: z.string().refine(val => parseFloat(val) > 0, "Amount must be greater than 0"),
  description: z.string().optional().default("Admin deposit"),
});

const setCreditLimitSchema = z.object({
  userId: z.string(),
  creditLimit: z.string().refine(val => parseFloat(val) >= 0, "Credit limit cannot be negative"),
});

const recordCreditPaymentSchema = z.object({
  userId: z.string(),
  amount: z.string().refine(val => parseFloat(val) > 0, "Payment amount must be greater than 0"),
  description: z.string().optional().default("Credit payment"),
});

export class WalletController {
  async getAllWallets(req: Request, res: Response) {
    try {
      const wallets = await walletService.getAllWalletsSummary();
      res.json({ data: wallets });
    } catch (error) {
      console.error("Error getting all wallets:", error);
      res.status(500).json({ message: "Failed to get wallets" });
    }
  }

  async getUserWallet(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const wallet = await walletService.getWalletSummary(userId);
      res.json({ data: wallet });
    } catch (error) {
      console.error("Error getting user wallet:", error);
      res.status(500).json({ message: "Failed to get user wallet" });
    }
  }

  async addDeposit(req: Request, res: Response) {
    try {
      const validation = addDepositSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: validation.error.errors 
        });
      }

      const { userId, amount, description } = validation.data;
      const adminId = (req.user as any)?.id;

      if (!adminId) {
        return res.status(401).json({ message: "Admin authentication required" });
      }

      const transaction = await walletService.addDeposit(userId, amount, description, adminId);
      const updatedWallet = await walletService.getWalletSummary(userId);

      res.status(201).json({ 
        message: `Successfully added €${amount} deposit`,
        data: { transaction, wallet: updatedWallet }
      });
    } catch (error) {
      console.error("Error adding deposit:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to add deposit" });
    }
  }

  async setCreditLimit(req: Request, res: Response) {
    try {
      const validation = setCreditLimitSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: validation.error.errors 
        });
      }

      const { userId, creditLimit } = validation.data;
      const adminId = (req.user as any)?.id;

      if (!adminId) {
        return res.status(401).json({ message: "Admin authentication required" });
      }

      const transaction = await walletService.setCreditLimit(userId, creditLimit, adminId);
      const updatedWallet = await walletService.getWalletSummary(userId);

      res.status(200).json({ 
        message: `Successfully set credit limit to €${creditLimit}`,
        data: { transaction, wallet: updatedWallet }
      });
    } catch (error) {
      console.error("Error setting credit limit:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to set credit limit" });
    }
  }

  async recordCreditPayment(req: Request, res: Response) {
    try {
      const validation = recordCreditPaymentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: validation.error.errors 
        });
      }

      const { userId, amount, description } = validation.data;
      const adminId = (req.user as any)?.id;

      if (!adminId) {
        return res.status(401).json({ message: "Admin authentication required" });
      }

      const transaction = await walletService.recordCreditPayment(userId, amount, description, adminId);
      const updatedWallet = await walletService.getWalletSummary(userId);

      res.status(200).json({ 
        message: `Successfully recorded €${amount} credit payment`,
        data: { transaction, wallet: updatedWallet }
      });
    } catch (error) {
      console.error("Error recording credit payment:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to record credit payment" });
    }
  }

  async getTransactionHistory(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const transactions = await walletService.getTransactionHistory(userId, limit);
      res.json({ data: transactions });
    } catch (error) {
      console.error("Error getting transaction history:", error);
      res.status(500).json({ message: "Failed to get transaction history" });
    }
  }
}

export const walletController = new WalletController();