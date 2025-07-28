import { Router } from 'express';
import { adminProductsController } from '../../controllers/admin/products.controller';
import { 
  authenticate, 
  authorize, 
  validateRequest, 
  auditLog,
  Permissions 
} from '../../middleware/auth.middleware';
import { uploadMiddleware } from '../../middleware/upload.middleware';
import { insertProductSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// All admin product routes require authentication
router.use(authenticate);

// Validation schemas
const productParamsSchema = z.object({
  id: z.string().min(1, 'Product ID is required'),
});

const getProductsQuerySchema = z.object({
  region: z.string().optional(),
  platform: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// GET /api/admin/products - Get all products (with filters and pagination)
router.get('/',
  authorize(Permissions.PRODUCT_READ),
  validateRequest({ query: getProductsQuerySchema }),
  auditLog('admin:products:list'),
  adminProductsController.getAllProducts.bind(adminProductsController)
);

// GET /api/admin/products/analytics - Get product analytics
router.get('/analytics',
  authorize(Permissions.REPORT_READ),
  auditLog('admin:products:analytics'),
  adminProductsController.getProductAnalytics.bind(adminProductsController)
);

// GET /api/admin/products/low-stock - Get low stock products
router.get('/low-stock',
  authorize(Permissions.PRODUCT_READ, Permissions.REPORT_READ),
  auditLog('admin:products:low-stock'),
  adminProductsController.getLowStockProducts.bind(adminProductsController)
);

// GET /api/admin/products/:id - Get specific product
router.get('/:id',
  authorize(Permissions.PRODUCT_READ),
  validateRequest({ params: productParamsSchema }),
  auditLog('admin:products:view'),
  adminProductsController.getProductById.bind(adminProductsController)
);

// POST /api/admin/products - Create new product
router.post('/',
  authorize(Permissions.PRODUCT_CREATE),
  validateRequest({ body: insertProductSchema }),
  auditLog('admin:products:create'),
  adminProductsController.createProduct.bind(adminProductsController)
);

// Create update schema with flexible price handling
const updateProductSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  htmlDescription: z.string().optional(),
  warranty: z.string().optional(),
  categoryId: z.string().optional(),
  platform: z.string().optional(),
  region: z.string().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().optional(),
  price: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  purchasePrice: z.union([z.string(), z.number(), z.literal("")]).transform(val => val === "" ? null : String(val)).optional(),
  retailPrice: z.union([z.string(), z.number(), z.literal("")]).transform(val => val === "" ? null : String(val)).optional(),
  priceKm: z.union([z.string(), z.number(), z.literal("")]).transform(val => val === "" ? null : String(val)).optional(),
  purchasePriceKm: z.union([z.string(), z.number(), z.literal("")]).transform(val => val === "" ? null : String(val)).optional(),
  retailPriceKm: z.union([z.string(), z.number(), z.literal("")]).transform(val => val === "" ? null : String(val)).optional(),
  stock: z.union([z.string(), z.number()]).transform(val => Number(val)).optional(),
}).partial();

// PUT /api/admin/products/:id - Update product
router.put('/:id',
  authorize(Permissions.PRODUCT_UPDATE),
  validateRequest({ 
    params: productParamsSchema,
    body: updateProductSchema
  }),
  auditLog('admin:products:update'),
  adminProductsController.updateProduct.bind(adminProductsController)
);

// DELETE /api/admin/products/:id - Delete product
router.delete('/:id',
  authorize(Permissions.PRODUCT_DELETE),
  validateRequest({ params: productParamsSchema }),
  auditLog('admin:products:delete'),
  adminProductsController.deleteProduct.bind(adminProductsController)
);

// PATCH /api/admin/products/:id/pricing - Update product pricing
const pricingUpdateSchema = z.object({
  costPrice: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  resellerPrice: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  retailPrice: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
});

router.patch('/:id/pricing',
  authorize(Permissions.PRODUCT_UPDATE),
  validateRequest({ 
    params: productParamsSchema,
    body: pricingUpdateSchema
  }),
  auditLog('admin:products:pricing-update'),
  adminProductsController.updateProductPricing.bind(adminProductsController)
);

// PATCH /api/admin/products/:id/toggle-status - Toggle product active status
router.patch('/:id/toggle-status',
  authorize(Permissions.PRODUCT_UPDATE),
  validateRequest({ params: productParamsSchema }),
  auditLog('admin:products:toggle-status'),
  adminProductsController.toggleProductStatus.bind(adminProductsController)
);

// POST /api/admin/products/:id/upload-image - Upload product image
router.post('/:id/upload-image',
  authorize(Permissions.PRODUCT_UPDATE),
  uploadMiddleware.single('image'),
  auditLog('admin:products:upload-image'),
  adminProductsController.uploadProductImage.bind(adminProductsController)
);

export { router as adminProductsRouter };