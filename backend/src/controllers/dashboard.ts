import { Request, Response, NextFunction } from "express";
import * as dashboardService from "../services/dashboard";

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await dashboardService.getDashboardStats(req.user!.userId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}
