import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


function generateAccessToken(payload: { userId: string; email: string }) {
  const expiresIn = (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as string;
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn } as jwt.SignOptions);
}

function generateRefreshToken(payload: { userId: string; email: string }) {
  const expiresIn = (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as string;
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn } as jwt.SignOptions);
}

export async function register(name: string, email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new (require("../middlewares/errorHandler").AppError)(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
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
    user: { id: user.id, name: user.name, email: user.email },
    accessToken,
    refreshToken,
    workspace,
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
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
    user: { id: user.id, name: user.name, email: user.email },
    accessToken,
    refreshToken,
  };
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
