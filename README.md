# Kanban Project Manager - AlwiStudio

Kanban board app buat manage project. Pake drag & drop, real-time sync (Socket.io), activity log, role-based access, notifikasi, dark mode, dan dashboard analytics.

## Tech Stack

- **Backend:** Express, TypeScript, Prisma, PostgreSQL, Socket.io, JWT, Zod, Multer
- **Frontend:** React 18, Vite, TypeScript, TailwindCSS 3, @dnd-kit, zustand, Socket.io-client, lucide-react, recharts, @headlessui/react

## Cara Jalanin di Local

### 1. Clone & masuk folder

```bash
git clone <repo-url>
cd KanbanProjectManager_AlwiStudio
```

### 2. Database (PostgreSQL via Docker)

```bash
docker compose up -d
```

Ini bakal jalanin PostgreSQL di `localhost:5432`, db `kanban_db`, user `kanban`, password `kanban123`.

### 3. Backend

```bash
cd backend
cp .env.example .env   # atau bikin manual (lihat template di bawah)
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Jalan di `http://localhost:4000`.

**.env template:**

```
DATABASE_URL="postgresql://kanban:kanban123@localhost:5432/kanban_db"
JWT_SECRET="kasih_string_random"
JWT_REFRESH_SECRET="kasih_string_random_lagi"
FRONTEND_URL="http://localhost:5173"
PORT=4000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Jalan di `http://localhost:5173`.

### 5. Buka Browser

Buka `http://localhost:5173`, register akun baru, langsung dapet workspace + 1 board dengan 3 kolom default (To Do, In Progress, Done).

## Fitur

### Auth & Workspace
- Register/login dengan JWT (access token 15m + refresh token 7d via httpOnly cookie)
- Auto-refresh token via axios interceptor
- **Session persistent** — tidak logout saat refresh/reload page (loading state + restore user dari refresh token)
- Workspace + board default otomatis pas register
- Profile & Settings page

### Board & Column Management
- CRUD board dalam workspace
- CRUD kolom dalam board (posisi bisa diatur via drag & drop)
- **Rename** kolom inline (double-click atau dropdown menu)
- **Reorder** kolom via drag handle
- **Rename & delete** board dari BoardPage header
- **Layout lengkap** — BoardPage sekarang pakai Sidebar + Topbar (Layout wrapper)
- **Task count chips** per kolom — `All Tasks N · To Do N · In Progress N · Done N`
- **`+ New Task` button** — popover cepat di action bar dengan column selector
- **`+ Add Column` card** — column card dengan dashed border di ujung kanan board
- **Breadcrumb** — `Home / Nama Board`, Home bisa diklik kembali ke dashboard
- Role-based access: admin/owner bisa manage kolom & board
- Konfirmasi dialog untuk semua aksi destructive (delete column/task/label/board/member)

### Boards Page
- **Dedicated Boards page** (`/boards`) — semua board per workspace dalam satu halaman
- Create board dengan inline form
- Loading skeleton saat fetching
- Empty state dengan call-to-action
- Klik board → navigasi ke Kanban board

### Task Management
- CRUD task dengan title, description, due date, position
- Drag & drop antar kolom (@dnd-kit) dengan optimistic update
- Version conflict check (409 → refresh board)
- Assignee management (multi-user)
- Label management (warna custom)
- File attachments (multer upload)
- Comments per task

### Real-time Sync (Socket.io)
- **Full sync:** task created/updated/deleted, column created/updated/deleted, label created/deleted, member added/updated/removed
- Board-based rooms (`board:join`/`board:leave`)
- Perubahan dari user lain langsung tampil tanpa refresh

### Dashboard Analytics
- **4 Stat Cards** — Total Tasks, Completed, Overdue, Avg Completion (data real-time dari API)
- **Progress Chart** — AreaChart (recharts) dengan toggle periode 30 hari / 7 hari / 24 jam
- **Top Kontributor** — peringkat anggota berdasarkan task selesai + progress bar
- **Distribusi Task per Kolom** — list kolom dengan jumlah task + persentase
- **Recent Tasks Table** — 5 task terbaru dengan avatar assignee, deadline, status overdue
- **Quick access** — klik "Lihat semua" di Recent Tasks → navigasi ke board terkait
- **Loading Skeletons** — animasi pulse saat loading data

### Activity Log
- Semua aksi tercatat: create task, move, rename, delete, comment, assign, upload
- Panel activity log per board

### Notifications
- Notifikasi pas di-assign ke task atau ada comment baru
- Unread count badge di topbar
- Mark read & mark all read
- Dropdown notifikasi di topbar

### Role & Permission
- Role: owner, admin, member, viewer
- Middleware `requireRole()` dengan lookup otomatis (board/column/task)
- Proteksi: delete/edit board/column/label → admin/owner
- Task CRUD → member ke atas
- Member invite → admin/owner
- UI: change role & remove member dari Members panel

### Search & Filter
- Search task by title (di BoardPage)
- Filter by label, assignee
- Clear filters
- **Global search** via Topbar (`⌘K` / `Ctrl+K`) — cari dan navigasi ke board

### Toast Notifications
- Feedback sukses/gagal tiap action (create, delete, rename, move, invite)
- Auto-dismiss 4 detik dengan slide-up animasi
- Type: success (hijau), error (merah), info (biru)

### UI/UX (Figma Kanban Board UI Kit)
- **Layout global** — Sidebar (search bar, menu badge count, user profile) + Topbar minimal + konten utama, berlaku di semua halaman
- **Warna brand** — `#6C4EF5` (purple-brand), background halaman `#F5F6FA` (bg-page)
- **Design tokens** — card `rounded-2xl`, button/input `rounded-full` (pill shape), shadow smooth, font Inter
- **Sidebar** — logo inisial ungu, search bar pill, menu 4 item (Home, Tasks, Users, Settings) dengan ikon + badge count, user profile bottom dengan avatar + logout
- **Topbar** — minimal (dark mode toggle + notifikasi dropdown + avatar user menu), tidak ada search di topbar
- **Dashboard analytics** — stat cards, area chart, contributor ranking, task distribution, recent tasks
- **Boards Page** — dedicate page (`/boards`) dengan card grid, inline create, loading skeleton, empty state
- **Kanban Board:**
  - Page header: breadcrumb `Home / Board`, avatar stack anggota, share button pill ungu, export button, `+` button bulat
  - Tab filter: By Status, By Total Tasks, Tasks Due, Extra Tasks, Tasks Completed
  - Sort dropdown: Due Date, Created, Alphabetical
  - Side panels: Log/Members/Labels — slide-in dari kanan, lebar konsisten w-80
  - Kolom scroll horizontal + `+ Add Column` card dashed di ujung kanan
   - **Column header:** pill solid warna-warni (8 warna palette), badge bulat putih jumlah task, drag handle `GripVertical` untuk reorder kolom, `+` button putih transparan, dropdown "..." untuk rename & delete
  - **Task card:** title bold, description `text-[#8A8FA3]` line-clamp-2, label badge warna dinamis (8 mapping warna), avatar stack kiri + komentar + views count kanan, `rounded-2xl` card putih, hover shadow
  - **Task modal:** modal scale-in animation, dynamic attachment icon, relative timestamp, search input di label & member picker
- **Dark mode** — class-based, persist localStorage
- **Confirm dialog** — scale-in animation, reusable untuk semua destructive actions

## API Routes

| Method | Route | Notes |
|--------|-------|-------|
| POST | /api/auth/register | |
| POST | /api/auth/login | |
| POST | /api/auth/refresh | refresh token |
| GET | /api/dashboard/stats | dashboard analytics |
| GET | /api/workspaces | include tasks & labels |
| GET/POST | /api/boards | |
| GET/PATCH/DELETE | /api/boards/:id | update/delete pake role check |
| POST | /api/boards/:id/columns | admin/owner only |
| POST/GET | /api/boards/:id/labels | |
| DELETE | /api/boards/:id/labels/:labelId | admin/owner only |
| GET | /api/boards/:id/activity | activity log |
| POST | /api/boards/:id/members | invite (admin/owner) |
| PATCH/DELETE | /api/boards/:id/members/:userId | (admin/owner) |
| PATCH/DELETE | /api/columns/:id | admin/owner only |
| POST | /api/columns/:id/tasks | |
| PATCH/DELETE | /api/tasks/:id | |
| POST/DELETE | /api/tasks/:id/assignees/:userId | |
| GET/POST | /api/tasks/:id/comments | |
| GET/POST | /api/tasks/:id/attachments | upload file |
| POST/DELETE | /api/tasks/:id/labels/:labelId | |
| GET | /api/notifications | |
| PATCH | /api/notifications/:id/read | |
| PATCH | /api/notifications/read-all | |
