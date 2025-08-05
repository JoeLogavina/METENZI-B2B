// Request validation middleware
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateRequestMiddleware(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error: any) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors || error.message
      });
    }
  };
}