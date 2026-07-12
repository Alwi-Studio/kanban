# DEPLOYMENT.md — Panduan Deploy Kanban Project Manager (Gratis)

Panduan lengkap membawa project dari **local development** ke **online**, 100% menggunakan free tier.

## 1. Ringkasan Stack Deployment

| Komponen | Layanan | Kenapa |
|---|---|---|
| Frontend (React/Vite) | **Vercel** | Auto-deploy dari GitHub, gratis, cocok untuk SPA |
| Backend (Node.js/Express + Socket.io) | **Render** (Web Service) | Mendukung WebSocket, gratis, mudah setup |
| Database PostgreSQL | **Neon** (atau Supabase) | Gratis permanen (bukan trial), serverless |
| File storage (attachment) | **Cloudinary** | Free tier 25GB, gampang integrasi upload |
| Uptime ping (opsional) | **cron-job.org** | Mencegah backend Render "tidur" saat idle |

```
GitHub (source code)
   │
   ├──▶ Vercel        → Frontend (React build)
   ├──▶ Render        → Backend (Node.js + Socket.io) → Web Service
   ├──▶ Neon/Supabase → Database PostgreSQL
   └──▶ Cloudinary    → File storage (attachment task)
```

## 2. Prasyarat
- Kode sudah jalan lancar di local (auth, CRUD, drag & drop, realtime)
- Akun GitHub (buat repo, login pakai ini juga ke Vercel/Render/Neon)
- File `.env` **tidak ter-commit** ke Git — pastikan ada di `.gitignore`:
  ```
  .env
  node_modules/
  dist/
  uploads/
  ```

## 3. Langkah 1 — Push Project ke GitHub

```bash
cd nama-project-kamu
git init
git add .
git commit -m "initial commit"
```

Buat repository baru di GitHub (kosong, tanpa README), lalu:

```bash
git remote add origin https://github.com/username/nama-repo.git
git branch -M main
git push -u origin main
```

> Bisa pakai 1 repo (monorepo dengan folder `frontend/` dan `backend/`) atau 2 repo terpisah. Panduan ini asumsikan **monorepo**.

## 4. Langkah 2 — Buat Database Gratis (Neon)

1. Daftar di [neon.tech](https://neon.tech) (bisa login via GitHub)
2. Buat **New Project** → pilih region terdekat (Singapore jika tersedia)
3. Neon otomatis memberi **connection string**, contoh:
   ```
   postgresql://user:password@ep-xxxx.ap-southeast-1.aws.neon.tech/kanban_db?sslmode=require
   ```
4. Copy & simpan string ini — dipakai sebagai `DATABASE_URL` di langkah berikutnya
5. Jalankan migrasi Prisma ke database baru ini dari local:
   ```bash
   cd backend
   DATABASE_URL="<connection-string-neon>" npx prisma migrate deploy
   ```
6. Cek tabel sudah terbentuk (bisa lewat Neon SQL editor di dashboard mereka)

> **Alternatif**: Supabase (supabase.com) — juga gratis, sudah termasuk auth & storage bawaan kalau nanti mau dipakai sekalian.

## 5. Langkah 3 — Buat File Konfigurasi Backend

### 5.1 Pastikan `package.json` backend punya script berikut
```json
{
  "scripts": {
    "build": "tsc && prisma generate",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  }
}
```

### 5.2 Pastikan server membaca `PORT` dari environment
```js
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```
Render menyuntikkan `PORT` otomatis — jangan hardcode port di kode.

### 5.3 (Opsional) `render.yaml` — supaya konfigurasi otomatis terbaca tanpa isi manual
Letakkan di root project:
```yaml
services:
  - type: web
    name: kanban-backend
    runtime: node
    rootDir: backend
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm run start
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: CLOUDINARY_URL
        sync: false
      - key: NODE_ENV
        value: production
```

## 6. Langkah 4 — Deploy Backend ke Render

1. Daftar/login di [render.com](https://render.com) (bisa via GitHub)
2. Klik **+ New** → pilih **Web Service** (bukan Static Site/Private Service/dll — Web Service yang mendukung Express + WebSocket)
3. Connect ke repo GitHub project kamu
4. Isi konfigurasi:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: Free
5. Tambahkan **Environment Variables**:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | connection string dari Neon |
   | `JWT_SECRET` | string acak panjang (generate: `openssl rand -base64 32`) |
   | `CLOUDINARY_URL` | dari dashboard Cloudinary (jika sudah pakai) |
   | `NODE_ENV` | `production` |
6. Klik **Create Web Service** → tunggu build selesai
7. Catat URL backend, contoh: `https://kanban-backend.onrender.com`

## 7. Langkah 5 — Deploy Frontend ke Vercel

1. Daftar/login di [vercel.com](https://vercel.com) (via GitHub)
2. **Add New Project** → import repo GitHub yang sama
3. Konfigurasi:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (otomatis terdeteksi)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default Vite)
4. Tambahkan **Environment Variable**:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://kanban-backend.onrender.com` |
5. Deploy → dapat URL, contoh: `https://kanban-kamu.vercel.app`

## 8. Langkah 6 — Update CORS di Backend

Edit konfigurasi CORS agar mengizinkan domain Vercel:
```js
app.use(cors({
  origin: [
    "https://kanban-kamu.vercel.app",
    "http://localhost:5173"
  ],
  credentials: true
}));
```
Untuk Socket.io juga:
```js
const io = new Server(server, {
  cors: {
    origin: ["https://kanban-kamu.vercel.app", "http://localhost:5173"],
    credentials: true
  }
});
```
Commit & push perubahan → Render otomatis redeploy.

## 9. Langkah 7 — Setup File Storage (Cloudinary)

1. Daftar di [cloudinary.com](https://cloudinary.com) (free tier 25GB)
2. Dari dashboard, copy **Cloudinary URL** (`CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name`)
3. Tambahkan ke Environment Variables Render (langkah 6 di atas)
4. Di backend, ganti driver upload dari lokal (`multer` disk storage) ke Cloudinary:
   ```js
   const { CloudinaryStorage } = require("multer-storage-cloudinary");
   const storage = new CloudinaryStorage({
     cloudinary,
     params: { folder: "kanban-attachments" }
   });
   const upload = multer({ storage });
   ```
5. Kontrak API tidak berubah — field `file_url` di database tetap sama, cuma sumbernya beda (URL Cloudinary, bukan path lokal)

## 10. Langkah 8 — Mencegah Backend "Tidur" (Opsional tapi Disarankan)

Render free tier akan sleep backend setelah idle ±15 menit, membuat request pertama lambat (30-50 detik). Solusi gratis:

1. Daftar di [cron-job.org](https://cron-job.org)
2. Buat cron job baru → target URL: `https://kanban-backend.onrender.com/health` (buat endpoint sederhana ini di backend agar selalu merespon 200 OK)
3. Set interval setiap 10-14 menit
4. Backend akan terus "keping bangun" tanpa perlu upgrade plan

Endpoint health check sederhana:
```js
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
```

## 11. Langkah 9 — Test End-to-End di Production

- [ ] Register & login dari domain Vercel
- [ ] Buat board, tambah kolom custom
- [ ] Drag & drop task antar kolom
- [ ] Buka 2 tab/browser berbeda → cek realtime sync (WebSocket) jalan
- [ ] Assign anggota tim ke task
- [ ] Tambah komentar
- [ ] Upload lampiran → cek muncul di dashboard Cloudinary
- [ ] Cek tampilan responsive di mobile

## 12. Checklist Sebelum "Go Live"
- [ ] Semua environment variable production sudah benar (bukan pakai value local)
- [ ] `.env` tidak ter-commit ke GitHub
- [ ] CORS sudah mengizinkan domain production
- [ ] Prisma migration sudah dijalankan ke database production (`migrate deploy`, bukan `migrate dev`)
- [ ] Health check endpoint aktif + cron-job.org sudah di-setup
- [ ] Password/secret (JWT_SECRET, dsb) berbeda dari yang dipakai di local

## 13. Batasan Free Tier yang Perlu Diketahui
| Layanan | Batasan |
|---|---|
| Render (Web Service Free) | Sleep setelah idle 15 menit; RAM/CPU terbatas; 750 jam/bulan gratis |
| Vercel (Hobby) | Cukup untuk personal/kecil; ada batas bandwidth bulanan |
| Neon (Free) | ~0.5 GB storage, auto-suspend saat idle (tapi wake otomatis saat ada request, beda dengan Render yang delay lebih lama) |
| Cloudinary (Free) | 25GB storage & bandwidth/bulan |
| Custom domain | Hosting gratis, tapi domain sendiri (`.com`, dsb) tetap perlu beli terpisah — bukan bagian dari free tier ini |

## 14. Alur Update Setelah Live
Setiap kali ada perubahan kode:
```bash
git add .
git commit -m "deskripsi perubahan"
git push origin main
```
Vercel & Render otomatis mendeteksi push baru dan redeploy otomatis (CI/CD bawaan, tidak perlu setup tambahan).
