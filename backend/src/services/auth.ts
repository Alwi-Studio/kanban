import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AppError } from "../middlewares/errorHandler";
import { sendPasswordResetEmail } from "./email";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashResetToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");
}


function generateAccessToken(payload: { userId: string; email: string }) {
  const expiresIn = (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as string;
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn } as jwt.SignOptions);
}

function generateRefreshToken(payload: { userId: string; email: string }) {
  const expiresIn = (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as string;
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn } as jwt.SignOptions);
}

export async function register(name: string, email: string, password: string) {
  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (existing) {
    throw new (require("../middlewares/errorHandler").AppError)(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const isFirstUser = await prisma.user.count() === 0;
  const user = await prisma.user.create({
    data: { name, email, passwordHash, isGlobalAdmin: isFirstUser },
  });

  // Auto-create default workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: "My Workspace",
      ownerId: user.id,
      boards: {
        create: {
          name: "My Board",
          members: {
            create: { userId: user.id, role: "admin" },
          },
          columns: {
            create: [
              { name: "To Do", position: 0 },
              { name: "In Progress", position: 1 },
              { name: "Done", position: 2 },
            ],
          },
        },
      },
    },
    include: {
      boards: {
        include: {
          columns: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  const payload = { userId: user.id, email: user.email };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, isGlobalAdmin: user.isGlobalAdmin },
    accessToken,
    refreshToken,
    workspace,
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user) {
    throw new (require("../middlewares/errorHandler").AppError)(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new (require("../middlewares/errorHandler").AppError)(401, "Invalid email or password");
  }

  const payload = { userId: user.id, email: user.email };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, isGlobalAdmin: user.isGlobalAdmin },
    accessToken,
    refreshToken,
  };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new AppError(401, "Current password is incorrect");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

// Always resolves without revealing whether the email exists (no user enumeration).
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user) return;

  // One active token per user: clear any previous requests first.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${frontendBaseUrl()}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

export async function resetPassword(rawToken: string, newPassword: string) {
  const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(rawToken) } });
  if (!token || token.usedAt || token.expiresAt < new Date()) {
    throw new AppError(400, "This reset link is invalid or has expired");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: token.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
  ]);
}

export function verifyRefreshToken(token: string) {
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as {
      userId: string;
      email: string;
    };
    return payload;
  } catch {
    throw new (require("../middlewares/errorHandler").AppError)(401, "Invalid refresh token");
  }
}

export function refreshTokens(userId: string, email: string) {
  const payload = { userId, email };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  return { accessToken, refreshToken };
}
