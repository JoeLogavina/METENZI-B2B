import { Router } from "express";
import { walletService } from "../services/wallet.service";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Apply authentication to all wallet routes
router.use(authenticate);

// B2B user wallet routes
router.get("/", async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ message: "User authentication required" });
    }

    const wallet = await walletService.getWalletSummary(userId);
    res.json({ data: wallet });
  } catch (error) {
    console.error("Error getting wallet:", error);
    res.status(500).json({ message: "Failed to get wallet information" });
  }
});

router.get("/transactions", async (req, res) => {
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