import "dotenv/config";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from "cloudinary";
import { AppError } from "./errorHandler";

export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

const allowedExtensions = new Set([
  ".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv", ".zip",
]);

function safeFileName(fileName: string) {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

const usesCloudinary = Boolean(process.env.CLOUDINARY_URL);

if (usesCloudinary) {
  // Reload configuration from CLOUDINARY_URL after dotenv has initialized.
  cloudinary.config(true);
  cloudinary.config({ secure: true });
}

function createStorage(): multer.StorageEngine {
  // Keep the file in memory so the official Cloudinary SDK can stream it.
  // This avoids multer-storage-cloudinary, which is incompatible with Cloudinary v2.
  if (usesCloudinary) return multer.memoryStorage();

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `${unique}-${safeFileName(file.originalname)}`);
    },
  });
}

export async function getUploadedFileUrl(file: Express.Multer.File): Promise<string> {
  if (!usesCloudinary) return `/uploads/${file.filename}`;
  if (!file.buffer) throw new AppError(500, "Uploaded file data is unavailable");

  try {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "kanban-attachments",
          resource_type: "auto",
          use_filename: true,
          unique_filename: true,
          filename_override: safeFileName(file.originalname),
        },
        (error: UploadApiErrorResponse | undefined, uploaded: UploadApiResponse | undefined) => {
          if (error) return reject(error);
          if (!uploaded?.secure_url) return reject(new Error("Cloudinary returned no file URL"));
          resolve(uploaded);
        },
      );
      stream.end(file.buffer);
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary attachment upload failed:", error);
    throw new AppError(502, "Attachment storage failed. Check the Cloudinary configuration and try again.");
  }
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
