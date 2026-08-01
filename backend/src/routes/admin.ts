import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth";
import { requireGlobalAdmin } from "../middlewares/adminOnly";
import { validate } from "../middlewares/validate";
import { deleteUser, listUsers, setGlobalAdmin, setUserPassword } from "../services/admin";

export const adminRouter = Router();

const globalAdminSchema = z.object({ isGlobalAdmin: z.boolean() });
const passwordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

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

adminRouter.patch("/users/:id/password", authenticate, requireGlobalAdmin, validate(passwordSchema), async (req, res, next) => {
  try {
    await setUserPassword(req.params.id, req.body.newPassword);
    res.json({ message: "Password updated" });
  } catch (err) { next(err); }
});

adminRouter.delete("/users/:id", authenticate, requireGlobalAdmin, async (req, res, next) => {
  try {
    await deleteUser(req.params.id, req.user!.userId);
    res.status(204).send();
  } catch (err) { next(err); }
});
