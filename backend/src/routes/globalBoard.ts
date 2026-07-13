import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { getGlobalBoard } from "../services/globalBoard";

export const globalBoardRouter = Router();

globalBoardRouter.get("/", authenticate, async (req, res, next) => {
  try {
    res.json(await getGlobalBoard(req.user!.userId));
  } catch (err) {
    next(err);
  }
});
