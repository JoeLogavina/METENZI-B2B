import { Router } from 'express';
import { UserEditController } from '../../controllers/admin/user-edit.controller';

const router = Router();

// All routes are prefixed with /api/admin/users
// User detail endpoints
router.get('/:userId', UserEditController.getUserById);
router.patch('/:userId', UserEditController.updateProfile);

// Wallet management endpoints
router.get('/:userId/wallet', UserEditController.getUserWallet);
router.post('/:userId/deposit', UserEditController.addDeposit);
router.patch('/:userId/credit-limit', UserEditController.updateCreditLimit);

// Product pricing endpoints
router.get('/:userId/pricing', UserEditController.getUserPricing);
router.post('/:userId/pricing', UserEditController.updateProductPricing);
router.delete('/:userId/pricing/:productId', UserEditController.deleteProductPricing);
router.delete('/:userId/pricing', UserEditController.deleteMultipleProductPricing);

// Transaction and payment history endpoints
router.get('/:userId/transactions', UserEditController.getTransactionHistory);
router.get('/:userId/payments', UserEditController.getPaymentHistory);

export { router as userEditRouter };