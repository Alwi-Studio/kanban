# DESAIN.md — Kanban Project Manager (Desain Teknis)

## 1. Arsitektur Sistem

```
┌─────────────────┐        REST API (HTTPS)        ┌──────────────────┐
│                  │ ───────────────────────────▶  │                  │
│  React.js (SPA)  │                                 │  Node.js/Express │
│  Vite + TS       │ ◀───────────────────────────   │  API Server      │
│                  │        WebSocket (realtime)    │                  │
└─────────────────┘ ◀───────────────────────────▶  └────────┬─────────┘
                                                              │
                                                              ▼
                                                    ┌──────────────────┐
                                                    │   PostgreSQL     │
                                                    │   (Prisma ORM)   │
                                                    └──────────────────┘
                                                              │
                                                              ▼
                                                    ┌──────────────────┐
                                                    │  File Storage    │
                                                    │ (local / S3-comp)│
                                                    └──────────────────┘
```

Pola: **Client-Server**, REST API untuk operasi CRUD, WebSocket untuk sinkronisasi realtime antar user di board yang sama.

## 2. Tech Stack Detail

### Frontend
- **React.js** + Vite (build cepat)
- **TypeScript** (disarankan, meminimalkan bug tipe data)
- **State management**: Zustand (ringan) atau Redux Toolkit jika state lebih kompleks
- **Drag & drop**: `@dnd-kit/core` (lebih modern & fleksibel dibanding react-beautiful-dnd yang sudah deprecated)
- **HTTP client**: Axios / TanStack Query (untuk caching & auto-refetch)
- **Realtime**: `socket.io-client`
- **Styling**: TailwindCSS
- **Routing**: React Router

### Backend
- **Node.js** + **Express.js**
- **ORM**: Prisma (schema-first, auto-generate types, migration mudah)
- **Auth**: JWT (access token pendek + refresh token), `bcrypt` untuk hash password
- **Realtime**: Socket.io (server)
- **Validasi**: Zod / express-validator
- **Upload file**: `multer` (dev, simpan lokal) → gampang dipindah ke S3 SDK di production

### Database
- **PostgreSQL** — dipilih karena relasi antar entitas (board–column–task–user–label) bersifat relasional kuat, butuh JOIN & integritas data (foreign key).

### Infrastruktur (opsional, untuk deployment)
- Docker + docker-compose (app + db dalam container, memudahkan setup)
- Reverse proxy: Nginx

## 3. Struktur Folder

```
kanban-project/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Board/
│   │   │   ├── Column/
│   │   │   ├── TaskCard/
│   │   │   ├── TaskModal/
│   │   │   └── Auth/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── store/          # Zustand stores
│   │   ├── services/       # API calls
│   │   ├── types/
│   │   └── App.tsx
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middlewares/    # auth, error handler, validation
│   │   ├── services/
│   │   ├── sockets/        # socket.io event handlers
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── index.ts
│   └── package.json
│
└── docker-compose.yml
```

## 4. Skema Database (ER Diagram)

```mermaid
erDiagram
    USERS ||--o{ BOARD_MEMBERS : "join"
    WORKSPACES ||--o{ BOARDS : has
    BOARDS ||--o{ BOARD_MEMBERS : has
    BOARDS ||--o{ COLUMNS : has
    COLUMNS ||--o{ TASKS : has
    TASKS ||--o{ TASK_ASSIGNEES : has
    USERS ||--o{ TASK_ASSIGNEES : "assigned"
    TASKS ||--o{ COMMENTS : has
    USERS ||--o{ COMMENTS : writes
    TASKS ||--o{ ATTACHMENTS : has
    TASKS ||--o{ TASK_LABELS : has
    LABELS ||--o{ TASK_LABELS : has
    BOARDS ||--o{ LABELS : defines
    BOARDS ||--o{ ACTIVITY_LOGS : has

    USERS {
        uuid id PK
        string name
        string email
        string password_hash
        datetime created_at
    }
    WORKSPACES {
        uuid id PK
        string name
        uuid owner_id FK
    }
    BOARDS {
        uuid id PK
        uuid workspace_id FK
        string name
        datetime created_at
    }
    BOARD_MEMBERS {
        uuid id PK
        uuid board_id FK
        uuid user_id FK
        string role "admin|pm|member|viewer"
    }
    COLUMNS {
        uuid id PK
        uuid board_id FK
        string name
        int position
    }
    TASKS {
        uuid id PK
        uuid column_id FK
        string title
        text description
        int position
        datetime due_date
        datetime created_at
        int version "optimistic locking"
    }
    TASK_ASSIGNEES {
        uuid id PK
        uuid task_id FK
        uuid user_id FK
    }
    LABELS {
        uuid id PK
        uuid board_id FK
        string name
        string color_hex
    }
    TASK_LABELS {
        uuid task_id FK
        uuid label_id FK
    }
    COMMENTS {
        uuid id PK
        uuid task_id FK
        uuid user_id FK
        text content
        datetime created_at
    }
    ATTACHMENTS {
        uuid id PK
        uuid task_id FK
        string file_url
        string file_name
        int file_size
        datetime uploaded_at
    }
    ACTIVITY_LOGS {
        uuid id PK
        uuid board_id FK
        uuid user_id FK
        string action
        datetime created_at
    }
```

**Catatan desain penting:**
- Kolom `position` (di `COLUMNS` dan `TASKS`) berupa integer/float untuk menjaga urutan saat drag & drop (gunakan teknik *fractional indexing* agar reorder tidak perlu update semua baris).
- Kolom `version` di `TASKS` untuk **optimistic locking**: cegah konflik saat 2 user memindahkan task yang sama secara bersamaan.

## 5. API Endpoints (REST)

| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/auth/register` | Daftar user baru |
| POST | `/api/auth/login` | Login, dapat access + refresh token |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/workspaces` | List workspace milik user |
| POST | `/api/workspaces` | Buat workspace |
| GET | `/api/boards?workspace_id=` | List board |
| POST | `/api/boards` | Buat board baru |
| GET | `/api/boards/:id` | Detail board (kolom + task) |
| PATCH | `/api/boards/:id` | Update nama board |
| DELETE | `/api/boards/:id` | Hapus board |
| POST | `/api/boards/:id/columns` | Tambah kolom custom |
| PATCH | `/api/columns/:id` | Rename/reorder kolom |
| DELETE | `/api/columns/:id` | Hapus kolom |
| POST | `/api/columns/:id/tasks` | Buat task baru |
| PATCH | `/api/tasks/:id` | Update task (termasuk pindah kolom/posisi) |
| DELETE | `/api/tasks/:id` | Hapus task |
| POST | `/api/tasks/:id/assignees` | Assign anggota ke task |
| DELETE | `/api/tasks/:id/assignees/:userId` | Un-assign |
| POST | `/api/tasks/:id/comments` | Tambah komentar |
| POST | `/api/tasks/:id/attachments` | Upload lampiran |
| POST | `/api/boards/:id/labels` | Buat label prioritas |
| POST | `/api/tasks/:id/labels/:labelId` | Pasang label ke task |
| GET | `/api/boards/:id/activity` | Ambil activity log |

## 6. Alur Drag & Drop (Realtime Sync)

1. User A drag task dari kolom "To Do" ke "In Progress" di UI (React state di-update **optimistic**, langsung terlihat berpindah).
2. Frontend kirim `PATCH /api/tasks/:id` berisi `column_id` baru, `position` baru, dan `version` lama.
3. Backend cek `version` — jika cocok, update data + increment version, lalu **emit event Socket.io** (`task:moved`) ke semua client yang terhubung ke board tsb.
4. Client lain (User B, C) menerima event dan mengupdate state board tanpa reload.
5. Jika `version` tidak cocok (sudah diubah user lain lebih dulu) → backend balas conflict (409), frontend fetch ulang state task terbaru.

## 7. Alur Autentikasi
1. Register → password di-hash bcrypt → simpan user.
2. Login → verifikasi password → generate **access token** (short-lived, ±15 menit) & **refresh token** (long-lived, disimpan sbg httpOnly cookie).
3. Setiap request API disertai access token di header `Authorization: Bearer <token>`.
4. Saat access token expired, frontend otomatis call `/api/auth/refresh` menggunakan refresh token.
5. Middleware backend cek role user di board (dari tabel `BOARD_MEMBERS`) untuk otorisasi aksi (misal hanya Admin/PM yang bisa hapus board).

## 8. Layout UI (Ringkasan Wireframe)
- **Sidebar kiri**: daftar Workspace → Board
- **Header atas**: nama board, foto avatar member yang online, tombol "Tambah Kolom", tombol "Invite Member"
- **Area utama**: kolom-kolom horizontal (scrollable), tiap kolom berisi card task (drag & drop antar kolom & reorder dalam kolom)
- **Task card**: judul, label warna prioritas, avatar assignee, indikator due date (merah jika overdue), ikon jumlah komentar & lampiran
- **Modal Task Detail**: deskripsi, assignee, due date, label, checklist, komentar (list + input baru), lampiran (upload + preview)

## 9. Keamanan
- Semua input divalidasi di backend (Zod schema), tidak percaya validasi frontend saja.
- Role-based access control di level middleware (cek `BOARD_MEMBERS.role` sebelum aksi sensitif).
- Rate limiting pada endpoint auth (cegah brute force login).
- File upload dibatasi ekstensi & ukuran (misal maks 10MB, cek MIME type asli bukan hanya ekstensi).
- CORS dikonfigurasi hanya untuk origin frontend yang diizinkan.

## 10. Rencana Pengembangan Bertahap (mengikuti roadmap PRD)
1. **Fase 1**: Setup project (frontend+backend+db), auth, CRUD board/kolom/task, drag & drop dasar (tanpa realtime dulu).
2. **Fase 2**: Tambah Socket.io realtime sync, assign anggota, komentar, upload lampiran, label prioritas.
3. **Fase 3**: Notifikasi in-app, activity log, role & permission lengkap, search/filter task.
4. **Fase 4 (v2)**: Automasi workflow, analytics dashboard, integrasi eksternal.

## 11. Setup Local Development

Prinsip: **build & test 100% di local dulu**, database & storage juga jalan di local (via Docker), baru pindah ke layanan cloud gratis saat siap deploy.

### 11.1 Kebutuhan
- Node.js LTS (v20+)
- Docker Desktop (untuk jalankan PostgreSQL lokal tanpa install manual)
- Git

### 11.2 Database lokal (Docker)
`docker-compose.yml` di root project:
```yaml
services:
  db:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_USER: kanban
      POSTGRES_PASSWORD: kanban123
      POSTGRES_DB: kanban_db
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
volumes:
  db_data:
```
Jalankan: `docker compose up -d` → database Postgres langsung aktif di `localhost:5432`, sama persis dengan Postgres yang nanti dipakai di production (Neon/Supabase), jadi tidak ada perbedaan perilaku SQL saat pindah.

### 11.3 Backend lokal
```bash
cd backend
npm install
cp .env.example .env   # isi DATABASE_URL="postgresql://kanban:kanban123@localhost:5432/kanban_db"
npx prisma migrate dev  # generate tabel dari schema.prisma
npm run dev              # jalankan Express + Socket.io, misal di localhost:4000
```

### 11.4 Frontend lokal
```bash
cd frontend
npm install
cp .env.example .env   # isi VITE_API_URL=http://localhost:4000
npm run dev              # Vite dev server, misal localhost:5173
```

### 11.5 File lampiran (attachment) saat local
Simpan langsung ke folder lokal `backend/uploads/` via `multer` (tanpa perlu akun Cloudinary dulu). Baru saat deploy, ganti driver storage ke Cloudinary tanpa mengubah kontrak API (`file_url` di DB tetap sama, cuma sumbernya beda).

### 11.6 Checklist sebelum pindah ke online
- [ ] Semua fitur inti (auth, CRUD, drag & drop, realtime) sudah jalan lancar di local
- [ ] `.env` dipisahkan jelas antara local & production (jangan commit `.env` ke Git — masukkan ke `.gitignore`)
- [ ] Migrasi Prisma sudah rapi & bisa dijalankan ulang (`prisma migrate deploy`) di database baru
- [ ] Ganti storage attachment dari lokal ke Cloudinary (tinggal ubah beberapa baris di service upload)
- [ ] Test CORS: frontend production (Vercel) harus diizinkan di backend production (Render)

## 12. Deployment Gratis (setelah local development selesai)

| Komponen | Layanan Gratis | Catatan |
|---|---|---|
| Frontend (React build) | **Vercel** / Netlify | Auto-deploy dari GitHub, cocok untuk SPA Vite |
| Backend (Node.js + Socket.io) | **Render** (free web service) | Mendukung WebSocket; sleep setelah idle ±15 menit (request pertama lambat) |
| Database PostgreSQL | **Neon** atau **Supabase** | Neon: serverless, auto-scale to zero. Supabase: 500MB gratis + auth/storage bawaan |
| File storage (attachment) | **Cloudinary** | Free tier 25GB, gampang integrasi upload gambar/dokumen |

**Kombinasi paling simpel & gratis:**
```
Frontend  → Vercel
Backend   → Render (Node.js + Socket.io)
Database  → Neon atau Supabase (Postgres)
Storage   → Cloudinary
```

### 12.1 Alur pindah dari local ke online
1. Push project ke GitHub (frontend & backend, boleh 1 repo monorepo atau 2 repo terpisah).
2. Buat database di Neon/Supabase → salin `DATABASE_URL` production → jalankan `npx prisma migrate deploy` mengarah ke DB tsb.
3. Deploy backend ke Render → set environment variables (`DATABASE_URL`, `JWT_SECRET`, `CLOUDINARY_*`) di dashboard Render, bukan hardcode di kode.
4. Deploy frontend ke Vercel → set `VITE_API_URL` mengarah ke URL backend Render.
5. Update konfigurasi CORS di backend agar domain Vercel diizinkan.
6. Test ulang seluruh fitur di environment production sebelum dibagikan ke tim.

### 12.2 Konsekuensi realistis free tier
- Backend Render bisa "tidur" saat idle → delay ~30-50 detik di request pertama setelah lama tidak diakses.
- Batas storage/bandwidth kecil di semua layanan gratis — cukup untuk belajar/demo/tim kecil, belum untuk skala produksi besar.
- Tanpa custom domain gratis di beberapa layanan (masih pakai subdomain bawaan, misal `*.onrender.com`, `*.vercel.app`).
- Kalau nanti dipakai serius oleh tim/organisasi, tinggal upgrade ke paid tier tanpa perlu ubah arsitektur (karena stack yang dipakai sama, cuma tier-nya beda).
