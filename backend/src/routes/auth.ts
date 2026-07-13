import { Router } from "express";
import { z } from "zod";
import * as authController from "../controllers/auth";
import { validate } from "../middlewares/validate";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").transform(value => value.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email").transform(value => value.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

authRouter.post("/register", validate(registerSchema), authController.register);
authRouter.post("/login", validate(loginSchema), authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);
