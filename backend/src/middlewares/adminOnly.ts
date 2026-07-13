import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { AppError } from "./errorHandler";

// Gate a route to global admins only. Assumes `authenticate` ran first.
export async function requireGlobalAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, "Unauthorized"));
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isGlobalAdmin: true },
    });
    if (!user?.isGlobalAdmin) return next(new AppError(403, "Global admin access required"));
    next();
  } catch (err) {
    next(err);
  }
}
