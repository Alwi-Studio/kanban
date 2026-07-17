import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { authRouter } from "./routes/auth";
import { boardRouter } from "./routes/boards";
import { columnRouter } from "./routes/columns";
import { taskRouter } from "./routes/tasks";
import { workspaceRouter } from "./routes/workspaces";
import { memberRouter } from "./routes/members";
import { notificationRouter } from "./routes/notifications";
import { dashboardRouter } from "./routes/dashboard";
import { globalBoardRouter } from "./routes/globalBoard";
import { adminRouter } from "./routes/admin";
import { statisticsRouter } from "./routes/statistics";
import { errorHandler } from "./middlewares/errorHandler";
import { setupSocket } from "./sockets";
import { getAttachmentStorageStatus, UPLOAD_DIR } from "./middlewares/upload";

dotenv.config();

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://kanban-project-manager-alwi-studio.vercel.app",
  "https://board-alwi-studio.vercel.app",
  ...(process.env.FRONTEND_URL || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean),
];

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    // Accept every Vercel deployment (production + preview) for this app so a
    // renamed or preview frontend URL does not silently break auth via CORS.
    if (host === "vercel.app" || host.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }
  return false;
}

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
};

const io = new Server(httpServer, {
  cors: corsOptions,
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(UPLOAD_DIR, { fallthrough: false }));

app.use("/api/auth", authRouter);
app.use("/api/workspaces", workspaceRouter);
app.use("/api/boards", boardRouter);
app.use("/api/columns", columnRouter);
app.use("/api/tasks", taskRouter);
app.use("/api", memberRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/global-board", globalBoardRouter);
app.use("/api/admin", adminRouter);
app.use("/api/statistics", statisticsRouter);

app.get("/health", (_req, res) => res.status(200).json({ status: "ok", attachmentStorage: getAttachmentStorageStatus() }));

app.use(errorHandler);

setupSocket(io);

const PORT = parseInt(process.env.PORT || "3000", 10);
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { io };
