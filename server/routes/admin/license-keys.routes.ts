import { Router } from "express";
import { adminLicenseKeysController } from "../../controllers/admin/license-keys.controller";
import { authenticate, requireRole } from "../../middleware/auth.middleware";

const router = Router();

// Temporarily disable complex middleware for debugging
// router.use(authenticate);
// router.use(requireRole("admin", "super_admin"));

// Simple auth check middleware
router.use((req: any, res, next) => {
  console.log('🔑 License keys route accessed:', req.method, req.path, 'User:', req.user?.username);
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    console.error('❌ User not authenticated for license keys');
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
});

// GET /api/admin/license-keys/all - Get all license keys with comprehensive filtering
router.get("/all", adminLicenseKeysController.getAllLicenseKeys);

// GET /api/admin/license-keys/:productId - Get all license keys for a product
router.get("/:productId", adminLicenseKeysController.getProductKeys);

// POST /api/admin/license-keys/:productId - Add license keys to a product
router.post("/:productId", adminLicenseKeysController.addKeys);

// DELETE /api/admin/license-keys/key/:keyId - Remove a specific license key
router.delete("/key/:keyId", adminLicenseKeysController.removeKey);

// GET /api/admin/license-keys/:productId/stats - Get key statistics for a product
router.get("/:productId/stats", adminLicenseKeysController.getKeyStats);

export default router;