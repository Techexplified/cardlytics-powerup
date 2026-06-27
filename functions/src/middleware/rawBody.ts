// src/middleware/rawBody.ts
import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export function rawBodyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If rawBody already set — skip
  if (req.rawBody) {
    next();
    return;
  }

  const chunks: Buffer[] = [];
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    req.rawBody = Buffer.concat(chunks);
    next();
  };

  req.on("data", (chunk: Buffer) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  req.on("end", finish);
  req.on("close", finish);

  // Safety timeout — don't hang forever
  setTimeout(() => {
    if (!finished) {
      finish();
    }
  }, 3000);
}