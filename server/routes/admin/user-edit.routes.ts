import { Router } from 'express';
import { userEditController } from '../../controllers/admin/user-edit.controller';

const router = Router();

// User profile management routes
router.get('/:userId', userEditController.getUserDetails.bind(userEditController));
router.patch('/:userId', userEditController.updateUserProfile.bind(userEditController));

// User product pricing routes
router.get('/:userId/pricing', userEditController.getUserProductPricing.bind(userEditController));
router.post('/:userId/pricing', userEditController.updateUserProductPricing.bind(userEditController));

// User wallet management routes
router.get('/:userId/wallet', userEditController.getUserWallet.bind(userEditController));
router.post('/:userId/wallet/deposit', userEditController.addWalletDeposit.bind(userEditController));
router.patch('/:userId/wallet/credit-limit', userEditController.updateCreditLimit.bind(userEditController));

// User transaction and payment history routes
router.get('/:userId/transactions', userEditController.getUserTransactions.bind(userEditController));
router.get('/:userId/payments', userEditController.getUserPayments.bind(userEditController));

export { router as userEditRouter };