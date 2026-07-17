import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import * as authService from "../services/auth";


const REFRESH_COOKIE = "refresh_token";
const isProduction = process.env.NODE_ENV === "production";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
  path: "/api/auth",
};

// The refresh cookie expires exactly when the absolute session does, so the
// browser drops it at the 6h mark instead of lingering for days.
function refreshCookieOptions(sessionExpiresAt: number) {
  return { ...COOKIE_OPTIONS, maxAge: Math.max(0, sessionExpiresAt - Date.now()) };
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body;
    const result = await authService.register(name, email, password);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(result.sessionExpiresAt));
    res.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
      sessionExpiresAt: result.sessionExpiresAt,
      workspace: result.workspace,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(result.sessionExpiresAt));
    res.json({
      user: result.user,
      accessToken: result.accessToken,
      sessionExpiresAt: result.sessionExpiresAt,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return res.status(401).json({ error: "No refresh token" });
    }
    const payload = authService.verifyRefreshToken(token);
    // Reject sessions past their absolute 6h cap, plus legacy tokens issued
    // before the cap existed (no sessionExp) — both force a fresh login.
    if (!payload.sessionExp || payload.sessionExp * 1000 <= Date.now()) {
      res.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS);
      return res.status(401).json({ error: "Session expired" });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, createdAt: true, isGlobalAdmin: true },
    });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    const tokens = authService.refreshTokens(payload.userId, payload.email, payload.sessionExp);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(tokens.sessionExpiresAt));
    res.json({ accessToken: tokens.accessToken, user, sessionExpiresAt: tokens.sessionExpiresAt });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ message: "Password updated" });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.requestPasswordReset(req.body.email);
    // Always the same response so an attacker cannot probe which emails exist.
    res.json({ message: "If an account exists for that email, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ message: "Password has been reset" });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: COOKIE_OPTIONS.httpOnly,
    secure: COOKIE_OPTIONS.secure,
    sameSite: COOKIE_OPTIONS.sameSite,
    path: COOKIE_OPTIONS.path,
  });
  res.json({ message: "Logged out" });
}
