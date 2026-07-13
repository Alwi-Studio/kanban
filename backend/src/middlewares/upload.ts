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

const explicitCloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};
const hasExplicitCloudinaryConfig = Object.values(explicitCloudinaryConfig).every(Boolean);
const usesCloudinary = Boolean(process.env.CLOUDINARY_URL || hasExplicitCloudinaryConfig);

if (usesCloudinary) {
  if (hasExplicitCloudinaryConfig) cloudinary.config(explicitCloudinaryConfig);
  else cloudinary.config(true); // Reload CLOUDINARY_URL after dotenv has initialized.
  cloudinary.config({ secure: true });
}

export function getAttachmentStorageStatus() {
  const config = cloudinary.config();
  return usesCloudinary
    ? { provider: "cloudinary", configured: Boolean(config.cloud_name && config.api_key && config.api_secret), cloudName: config.cloud_name || null }
    : { provider: "local", configured: true, cloudName: null };
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
    const cloudinaryError = error as UploadApiErrorResponse;
    console.error("Cloudinary attachment upload failed:", {
      name: cloudinaryError.name,
      status: cloudinaryError.http_code,
      message: cloudinaryError.message,
    });
    if (cloudinaryError.http_code === 401 || /invalid (api key|signature)|unknown api key/i.test(cloudinaryError.message || "")) {
      throw new AppError(502, "Cloudinary credentials were rejected. Update the Cloudinary variables in Railway.");
    }
    if (cloudinaryError.http_code === 403 || /denied|blocked|untrusted|acl/i.test(cloudinaryError.message || "")) {
      throw new AppError(502, "Cloudinary blocked this file. Check the product environment security settings.");
    }
    if (cloudinaryError.http_code === 400) {
      throw new AppError(400, "Cloudinary rejected this file or upload configuration.");
    }
    throw new AppError(502, "Cloudinary could not be reached. Try the upload again.");
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
