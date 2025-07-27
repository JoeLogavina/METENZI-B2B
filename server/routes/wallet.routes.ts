import { Router } from "express";
import { walletService } from "../services/wallet.service";

const router = Router();

// B2B user wallet routes (authentication handled by main routes)
router.get("/", async (req: any, res) => {
  try {
    console.log("Wallet API called, user:", req.user?.username, "ID:", req.user?.id);
    const userId = (req.user as any)?.id;
    if (!userId) {
      console.log("No user ID found in request");
      return res.status(401).json({ message: "User authentication required" });
    }

    console.log("Getting wallet summary for user:", userId);
    const wallet = await walletService.getWalletSummary(userId);
    console.log("Wallet summary retrieved:", wallet);
    res.json({ data: wallet });
  } catch (error) {
    console.error("Error getting wallet:", error);
    res.status(500).json({ message: "Failed to get wallet information", error: error.message });
  }
});

router.get("/transactions", async (req: any, res) => {
  try {
    const userId = (req.user as any)?.id;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!userId) {
      return res.status(401).json({ message: "User authentication required" });
    }

    const transactions = await walletService.getTransactionHistory(userId, limit);
    res.json({ data: transactions });
  } catch (error) {
    console.error("Error getting transaction history:", error);
    res.status(500).json({ message: "Failed to get transaction history" });
  }
});

export default router;