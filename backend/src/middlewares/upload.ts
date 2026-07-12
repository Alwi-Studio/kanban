import multer from "multer";
import path from "path";

function createStorage(): multer.StorageEngine {
  if (process.env.CLOUDINARY_URL) {
    try {
      const cloudinary = require("cloudinary").v2;
      const { CloudinaryStorage } = require("multer-storage-cloudinary");
      cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
      return new CloudinaryStorage({
        cloudinary,
        params: { folder: "kanban-attachments" },
      });
    } catch (e) {
      console.warn("Cloudinary packages not found, falling back to local storage:", (e as Error).message);
    }
  }

  return multer.diskStorage({
    destination: path.join(__dirname, "../../uploads"),
    filename: (_req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + "-" + file.originalname);
    },
  });
}

export const upload = multer({
  storage: createStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|txt|zip|svg/;
    const ext = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const allowedMime = /^image\/(jpeg|png|gif|webp|svg\+xml)|application\/(pdf|msword|vnd\.openxmlformats-officedocument|zip)|text\/plain/;
    const mime = allowedMime.test(file.mimetype);
    if (ext || mime) return cb(null, true);
    cb(new Error("File type not allowed"));
  },
});
