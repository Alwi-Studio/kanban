import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth";
import { requireGlobalAdmin } from "../middlewares/adminOnly";
import { validate } from "../middlewares/validate";
import { listUsers, setGlobalAdmin } from "../services/admin";

export const adminRouter = Router();

const globalAdminSchema = z.object({ isGlobalAdmin: z.boolean() });

adminRouter.get("/users", authenticate, requireGlobalAdmin, async (_req, res, next) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (err) { next(err); }
});

adminRouter.patch("/users/:id/global-admin", authenticate, requireGlobalAdmin, validate(globalAdminSchema), async (req, res, next) => {
  try {
    const user = await setGlobalAdmin(req.params.id, req.body.isGlobalAdmin);
    res.json(user);
  } catch (err) { next(err); }
});
