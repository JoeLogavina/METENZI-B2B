import { Request, Response } from "express";
import { licenseKeyService } from "../../services/license-key.service";
import { z } from "zod";

class ApplicationError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = "ApplicationError";
  }
}

class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message, 400);
    this.name = "ValidationError";
  }
}

const addKeysSchema = z.object({
  keys: z.string().min(1, "Keys are required"),
  ignoreDuplicates: z.boolean().optional().default(false),
});

export class AdminLicenseKeysController {
  async getProductKeys(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      
      if (!productId) {
        throw new ValidationError("Product ID is required");
      }
      
      const keys = await licenseKeyService.getProductKeys(productId);
      const stats = await licenseKeyService.getKeyStats(productId);
      
      res.json({
        data: keys,
        stats,
        message: "License keys retrieved successfully"
      });
    } catch (error) {
      console.error("Error in getProductKeys:", error);
      if (error instanceof ApplicationError) {
        res.status(error.statusCode).json({ 
          error: error.name, 
          message: error.message 
        });
      } else {
        res.status(500).json({ 
          error: "INTERNAL_ERROR", 
          message: "Failed to retrieve license keys" 
        });
      }
    }
  }

  async addKeys(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      const validatedData = addKeysSchema.parse(req.body);
      
      if (!productId) {
        throw new ValidationError("Product ID is required");
      }
      
      // Parse keys from textarea input (split by newlines)
      const keyValues = validatedData.keys
        .split('\n')
        .map(key => key.trim())
        .filter(key => key.length > 0);
      
      if (keyValues.length === 0) {
        throw new ValidationError("No valid keys provided");
      }
      
      const result = await licenseKeyService.addKeys(productId, keyValues);
      
      // If there are duplicates and user hasn't acknowledged them
      if (result.duplicates.length > 0 && !validatedData.ignoreDuplicates) {
        res.status(409).json({
          error: "DUPLICATE_KEYS",
          message: "Some keys already exist",
          data: {
            duplicates: result.duplicates,
            newKeys: result.added.length
          }
        });
        return;
      }
      
      const stats = await licenseKeyService.getKeyStats(productId);
      
      res.status(201).json({
        data: {
          added: result.added,
          duplicates: result.duplicates,
          stats
        },
        message: `Successfully added ${result.added.length} license keys`
      });
    } catch (error) {
      console.error("Error in addKeys:", error);
      if (error instanceof ApplicationError) {
        res.status(error.statusCode).json({ 
          error: error.name, 
          message: error.message 
        });
      } else {
        res.status(500).json({ 
          error: "INTERNAL_ERROR", 
          message: "Failed to add license keys" 
        });
      }
    }
  }

  async removeKey(req: Request, res: Response) {
    try {
      const { keyId } = req.params;
      
      if (!keyId) {
        throw new ValidationError("Key ID is required");
      }
      
      await licenseKeyService.removeKey(keyId);
      
      res.json({
        message: "License key removed successfully"
      });
    } catch (error) {
      console.error("Error in removeKey:", error);
      if (error instanceof ApplicationError) {
        res.status(error.statusCode).json({ 
          error: error.name, 
          message: error.message 
        });
      } else {
        res.status(500).json({ 
          error: "INTERNAL_ERROR", 
          message: "Failed to remove license key" 
        });
      }
    }
  }

  async getKeyStats(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      
      if (!productId) {
        throw new ValidationError("Product ID is required");
      }
      
      const stats = await licenseKeyService.getKeyStats(productId);
      
      res.json({
        data: stats,
        message: "Key statistics retrieved successfully"
      });
    } catch (error) {
      console.error("Error in getKeyStats:", error);
      if (error instanceof ApplicationError) {
        res.status(error.statusCode).json({ 
          error: error.name, 
          message: error.message 
        });
      } else {
        res.status(500).json({ 
          error: "INTERNAL_ERROR", 
          message: "Failed to retrieve key statistics" 
        });
      }
    }
  }
}

export const adminLicenseKeysController = new AdminLicenseKeysController();