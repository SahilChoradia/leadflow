import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Zod validation middleware factory.
 * Usage: router.post('/', validate(MySchema), myController)
 *
 * On validation failure returns 422 with a structured list of field errors,
 * never leaking internal stack traces.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(422).json({ success: false, error: 'Validation failed', errors });
      return;
    }
    req.body = result.data; // replace with coerced/stripped data
    next();
  };
}
