import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "../services/notification";

export const notificationRouter = Router();

notificationRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const notifications = await getNotifications(req.user!.userId);
    const unread = await getUnreadCount(req.user!.userId);
    res.json({ notifications, unread });
  } catch (err) { next(err); }
});

notificationRouter.patch("/:id/read", authenticate, async (req, res, next) => {
  try {
    await markAsRead(req.params.id, req.user!.userId);
    res.json({ message: "Marked as read" });
  } catch (err) { next(err); }
});

notificationRouter.patch("/read-all", authenticate, async (req, res, next) => {
  try {
    await markAllAsRead(req.user!.userId);
    res.json({ message: "All marked as read" });
  } catch (err) { next(err); }
});
