import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
  ) {
    super(message);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is larger than 10 MB" : err.message;
    return res.status(status).json({ error: message });
  }

  if (err.message === "File type not allowed") {
    return res.status(400).json({ error: err.message });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).json({ error: "That value already exists" });
    if (err.code === "P2025") return res.status(404).json({ error: "Resource not found" });
  }

  const status = (err as Error & { status?: number; statusCode?: number }).status
    || (err as Error & { status?: number; statusCode?: number }).statusCode;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ error: err.message || "Request failed" });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
}
