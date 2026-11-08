
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import type { ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Некорректные данные",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    req.body = parsed.data;
    next();
  };
}
