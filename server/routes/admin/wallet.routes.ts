import { Router } from "express";
import { walletController } from "../../controllers/admin/wallet.controller";
import { authenticate, requireRole } from "../../middleware/auth.middleware";

const router = Router();

// Apply authentication and admin permission to all wallet routes
router.use(authenticate);
router.use(requireRole("admin", "super_admin"));

// Admin wallet management routes
router.get("/", walletController.getAllWallets);
router.get("/:userId", walletController.getUserWallet);
router.post("/:userId/deposit", walletController.addDeposit);
router.post("/:userId/credit-limit", walletController.setCreditLimit);
router.post("/:userId/credit-payment", walletController.recordCreditPayment);
router.get("/:userId/transactions", walletController.getTransactionHistory);

export default router;