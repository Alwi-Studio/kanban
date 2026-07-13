import multer from "multer";
import path from "path";
import fs from "fs";

export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

const allowedExtensions = new Set([
  ".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv", ".zip",
]);

function safeFileName(fileName: string) {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function createStorage(): multer.StorageEngine {
  if (process.env.CLOUDINARY_URL) {
    try {
      const cloudinary = require("cloudinary").v2;
      const { CloudinaryStorage } = require("multer-storage-cloudinary");
      cloudinary.config(process.env.CLOUDINARY_URL);
      return new CloudinaryStorage({
        cloudinary,
        params: async (_req: unknown, file: Express.Multer.File) => ({
          folder: "kanban-attachments",
          resource_type: "auto",
          public_id: `${Date.now()}-${safeFileName(path.parse(file.originalname).name)}`,
        }),
      });
    } catch (e) {
      console.warn("Cloudinary packages not found, falling back to local storage:", (e as Error).message);
    }
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `${unique}-${safeFileName(file.originalname)}`);
    },
  });
}

export const upload = multer({
  storage: createStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = allowedExtensions.has(path.extname(file.originalname).toLowerCase());
    if (ext) return cb(null, true);
    cb(new Error("File type not allowed"));
  },
});
