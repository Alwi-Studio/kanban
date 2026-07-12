import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import * as dashboardController from "../controllers/dashboard";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", authenticate, dashboardController.getStats);
