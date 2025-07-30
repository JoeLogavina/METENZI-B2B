import { Router } from "express";
import { adminLicenseKeysController } from "../../controllers/admin/license-keys.controller";
import { authenticate, requireRole } from "../../middleware/auth.middleware";

const router = Router();

// Apply authentication and admin permission to all routes
router.use(authenticate);
router.use(requireRole("admin", "super_admin"));

// GET /api/admin/license-keys/:productId - Get all license keys for a product
router.get("/:productId", adminLicenseKeysController.getProductKeys);

// POST /api/admin/license-keys/:productId - Add license keys to a product
router.post("/:productId", adminLicenseKeysController.addKeys);

// DELETE /api/admin/license-keys/key/:keyId - Remove a specific license key
router.delete("/key/:keyId", adminLicenseKeysController.removeKey);

// GET /api/admin/license-keys/:productId/stats - Get key statistics for a product
router.get("/:productId/stats", adminLicenseKeysController.getKeyStats);

export default router;