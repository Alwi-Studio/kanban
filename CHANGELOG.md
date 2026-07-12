# Changelog

## [3.2.0] — Fase 9.2: Column Drag Handle Reorder

### Added
- **Column drag handle** — tombol `GripVertical` di header kolom (kiri badge) untuk reorder kolom via drag & drop, menggunakan `setActivatorNodeRef` dari `@dnd-kit` `useSortable`

### Fixed
- **Column reorder tidak bisa di-drag** — `useSortable` sudah dikonfigurasi sejak Fase 6 tapi drag handle tidak dirender setelah redesign Fase 9; sekarang handle muncul sebagai lingkaran putih transparan di pojok kiri header kolom

## [3.1.0] — Fase 9.1: Sidebar Simplification & CSS Fix

### Removed
- **Sidebar menu** — hapus 3 item: APIs, Subscription, Help
- **Sidebar promo card** — hapus "Upgrade Plan", "Get access to all features", "Go Pro"
- **Import icons** — bersihkan `Zap`, `CreditCard`, `HelpCircle`, `ChevronRight` yang tidak terpakai

### Fixed
- **CSS build error** — ganti `@apply bg-bg-page` dengan `background-color: var(--bg-page)` karena nested color key `bg.page` tidak bisa di-resolve oleh `@apply` di `@layer base`

## [3.0.0] — Fase 9: UI Redesign — Figma Kanban Board UI Kit

### Changed
- **Desain ulang total** — dari TailAdmin-inspired ke Figma "3 Free Kanban Board App UI Kit": playful, pill-shape, rounded-2xl, warna solid per kolom
- **Warna brand** — dari `#465FFF` ke `#6C4EF5` (purple-brand)
- **Background halaman** — dari `#F9FAFB` ke `#F5F6FA` (bg-page)
- **Design tokens** (`tailwind.config.js`, `index.css`):
  - Card: `rounded-2xl` dari sebelumnya `rounded-xl`
  - Button: `rounded-full` (pill shape), bg solid untuk primary, border untuk secondary
  - Input: `rounded-full` (pill shape)
  - Warna baru: `purple-brand` (#6C4EF5), `col-orange` (#F5A623), `col-green` (#2ECC71), `bg-page` (#F5F6FA)
- **Sidebar** (redesign total):
  - Logo inisial ungu (lingkaran) + nama "AlwiStudio"
  - Search bar pill dengan Search icon
  - Menu 7 item: Dashboard, Boards, Teams, Analytics, Messages, Calendar, Settings (masing-masing dengan icon + badge count)
  - Promo card "Upgrade Plan" dengan bg gradient
  - User profile bottom: avatar, nama, email, logout icon
- **Topbar** (redesign minimal):
  - Hanya dark mode toggle, notifikasi dropdown (mark read / mark all read), avatar user menu (profile, settings, sign out)
  - Search dihapus dari topbar (pindah ke sidebar)
- **ColumnView** (redesign total):
  - Header: pill solid lebar penuh dengan warna dari palette 8 warna (col-1 s/d col-8)
  - Badge: lingkaran putih solid dengan teks warna kolom untuk jumlah task
  - `+` button: putih dengan opacity, di kanan header
  - Dropdown "..." untuk Rename & Delete
  - Empty state teks + dashed border
- **TaskCard** (redesign total):
  - Label badge colors: 8 mapping warna (Bug → #E74C3C, Feature → #6C4EF5, Improvement → #3498DB, Design → #F5A623, Documentation → #2ECC71, Testing → #EC4899, Maintenance → #1ABC9C, Security → #8B5CF6)
  - Judul bold, description line-clamp-2 warna `#8A8FA3`
  - AvatarStack kiri, comment icon + views count kanan
  - `rounded-2xl`, hover shadow transition
- **BoardPage** (redesign total):
  - Page header: breadcrumb `Home / Board Name`, avatar stack anggota, topbar di kanan
  - Action buttons: search icon, Share pill ungu, export icon, `+` bulat
  - Tab filter bar: By Status, By Total Tasks, Tasks Due, Extra Tasks, Tasks Completed
  - Sort dropdown: Due Date, Created, Alphabetical
  - Side panels (Log/Members/Labels): slide-in dari kanan, w-80
  - Empty state + loading skeleton
- **TaskModal** — update brand color `#465FFF` → `#6C4EF5`, buttons & input jadi pill shape
- **Badge** — update default color `#465FFF` → `#6C4EF5`

### Added
- 8 warna palette untuk column header (col-1 s/d col-8): #6C4EF5, #F5A623, #2ECC71, #E74C3C, #3498DB, #EC4899, #1ABC9C, #8B5CF6
- 8 mapping warna untuk task label (Bug, Feature, Improvement, Design, Documentation, Testing, Maintenance, Security)
- Search bar di Sidebar (sebelumnya di Topbar)
- Menu badge count di Sidebar (Dashboard: 8, dll)
- Promo card "Upgrade Plan" di Sidebar
- Avatars anggota di Board Page header

### Added
- **Board Page Layout** — konten utama BoardPage sekarang terbungkus `<Layout>` (Sidebar + Topbar), sebelumnya hanya loading/notFound state saja yang pakai
- **`+ New Task` button** — popover di action bar dengan column selector + title input, bisa create task cepat ke kolom manapun
- **`+ Add Column` card** — column card dengan `border-dashed` di ujung kanan area board, hover effect, form create muncul saat diklik
- **`BrowserRouter` future flags** — `v7_startTransition` dan `v7_relativeSplatPath` di `main.tsx` untuk hilangkan warning React Router v6

### Changed
- **Breadcrumb** — dari `Board / name` jadi `Home / Nama Board`, dengan `Home` bisa diklik navigasi ke dashboard
- **Task count chips** — dari hanya `{totalTasks} tasks` jadi per-kolom: `All Tasks N · To Do N · In Progress N · Done N`
- **Action bar** — tata ulang layout dengan separator vertikal, button icon-only dengan tooltip
- **"Add Column" form** — styling baru: `bg-brand/5`, `border-brand/30`, title "Add Column" di atas input

## [2.4.0] — Fase 7: Auth Persistence Fix — No More Auto-Logout on Refresh

### Fixed
- **Auto-logout saat refresh/reload page** — root cause: race condition antara render ProtectedRoute dengan async refresh token, ditambah user object tidak direstore setelah refresh
- **Backend** (`backend/src/controllers/auth.ts`): endpoint `POST /auth/refresh` sekarang return `{ accessToken, user }` (fetch user dari DB)
- **Frontend** (`frontend/src/store/authStore.ts`): tambah state `isLoading` (default `true`) + method `setLoading()` — mencegah redirect sebelum auth selesai dicek
- **Frontend** (`frontend/src/services/auth.ts`): `register()`, `login()`, `refreshToken()`, `logout()` sekarang langsung set/unset user di store via `useAuthStore.getState().setUser()`
- **Frontend** (`frontend/src/App.tsx`): `ProtectedRoute` & `GuestRoute` return `null` saat `isLoading`; setelah refresh selesai (success/gagal) baru `setLoading(false)`

## [2.3.0] — Fase 6: UI/UX Polish — Board Page & Components

### Added
- **CSS Animations** (`frontend/src/index.css`)
  - `animate-slide-right` — side panel slide-in dari kanan (Log, Members, Labels)
  - `animate-scale-in` — modal & confirm dialog scale-in (TaskModal, ConfirmDialog)
- **AvatarStack** — warna background random per user (hash-based dari 8 color palette), ring konsisten, +remaining lebih rapi
- **TaskCard**
  - Delete button pake `X` icon dari lucide-react (dengan hover bg-red-50)
  - Overdue card: bg-red-50/50 tint + border-left red, close card: bg-yellow-50/50 tint
  - Drag overlay: `scale-[1.02] rotate-[1deg]` + shadow-xl
  - Hover: shadow-md + border-gray-300 (dark: border-gray-600)
- **ColumnView**
  - Drag handle (`GripVertical`) hanya visible saat hover column (`opacity-0 group-hover/col:opacity-100`)
  - Rename: cukup **double-click on column name** (tidak perlu tombol Edit3 terpisah)
  - Dropdown "..." menu untuk Rename & Delete (muncul saat hover)
  - Rename input: border-brand/50 + focus ring-brand/20
  - Empty state: teks "Drop tasks here" lebih subtle + py-8
- **TaskModal**
  - `relativeTime()` helper — "just now", "5m ago", "2h ago", "3d ago", fallback ke date string
  - `attachmentIcon()` dynamic — Image (jpg/png/gif/webp/svg), FileText (pdf/doc/txt/md), File (lainnya)
  - Search input dengan icon Search di label picker & member picker
  - Modal: `animate-scale-in` class
  - Assignee & label remove pake `X` icon (bukan "✕")
  - Comment avatar warna random per user
- **BoardPage**
  - Header: back button "Back to Dashboard", board rename/delete button muncul saat hover group, breadcrumb clean ("Board / name")
  - Task count chips: `bg-brand/10 text-brand` pill style
  - Action bar: search ada icon, action buttons icon-only dengan tooltip, dipisah divider vertikal
  - Side panels: semua width 80 (= w-80), header icon + title + X close, `animate-slide-right`
  - Loading: skeleton dengan 3 column placeholder + header placeholder
  - Board not found: ilustrasi `ListTodo` icon + "Back to Dashboard" button
  - Empty board (no columns): CTA "Create your first column"
  - Kanvas board area: `bg-gray-50/50 border border-gray-100` subtle background
- **ConfirmDialog** — `animate-scale-in` untuk modal card

### Changed
- UI detail passing — semua komponen lebih konsisten, rapi, dan modern (TailAdmin-inspired)
- Side panels tidak lagi hardcoded width berbeda (dulu 80w / 56w sekarang semua 80w)
- Filter bar active state lebih jelas (bg-brand/10 border-brand/30)

## [2.1.0] — Fase 4: Dashboard Analytics, Real-time, Board Cleanup & General Polish

### Added
- **Backend**
  - `GET /api/dashboard/stats` — endpoint dedicated buat dashboard: totalTasks, completedTasks, overdueTasks, avgCompletionTime, tasksPerColumn, topContributors, recentTasks, taskTrends (30 hari)
  - Dashboard route + controller + service layer
  - `GET /api/workspaces` sekarang include nested tasks + assignees + taskLabels + counts
- **Frontend — Dashboard Analytics**
  - **Progress Chart** — AreaChart (recharts) dengan 2 line (Dibuat / Selesai), toggle periode 30d/7d/24h
  - **Top Kontributor** — ranking anggota based on completed tasks + progress bar
  - **Distribusi Task per Kolom** — list kolom + count + persentase + progress bar
  - **Recent Tasks Table** — 5 task terbaru: judul, board, assignee (avatar stack), deadline (merah jika overdue)
  - **Loading skeletons** — animated pulse cards, rows, dan charts saat loading
  - Semua hardcoded stat values (trend, overdue, avg completion) diganti data real dari API
- **Frontend — Board Page Enhancements**
  - **Column rename** — inline edit (pencil icon, save on Enter/blur, cancel on Escape)
  - **Column reorder** — drag handle (GripVertical), SortableContext horizontal, update posisi via API
  - **Board rename & delete** — inline edit header + tombol delete dengan confirm dialog
  - **Full real-time sync** — listener baru: `task:created`, `column:*`, `label:*`, `member:*` (total 11 event)
  - **Store actions baru** — `addTaskToState`, `updateColumnInState`, `removeColumnFromState`, `addColumnToState`, `addLabelToBoard`, `removeLabelFromBoard`, `addMemberToBoard`, `updateMemberInBoard`, `removeMemberFromBoard`
  - **Member role change** — dropdown (admin/member/viewer) per member
  - **Member remove** — tombol hapus dengan confirm dialog
  - **Toast notifications** — feedback sukses/gagal tiap action (auto-dismiss 4s, slide-up animasi)
  - **Confirm dialog** — reusable modal untuk semua destructive actions (delete column/task/label/board/member)
- **Frontend — General**
  - **Dark mode persist** — `useDarkMode` hook, baca/tulis localStorage, auto-sync DOM
  - **Global search** — modal overlay + `⌘K`/`Ctrl+K` shortcut, navigate to dashboard with query
  - **Profile page** — `/profile`, menampilkan avatar, nama, email
  - **Settings page** — `/settings`, toggle dark mode
  - **Sidebar cleanup** — hapus menu Task List & Calendar (belum ada halaman)
  - **Hardcoded localhost fix** — `API_BASE` constant di `api.ts`, dipakai di socket.ts & TaskModal untuk attachment URL
  - **Shared config** — `API_BASE` diexport dari `api.ts`, ganti hardcoded URL di socket.ts

### Changed
- **DashboardPage** — full rewrite dari 104 baris ke ~290 baris, layout grid dengan chart & panels
- **BoardPage** — full rewrite, penambahan semua fitur baru (socket, rename, reorder, toast, confirm)
- **ColumnView** — penambahan inline rename + drag handle column reorder
- **boardStore** — dari 4 actions jadi 12 actions
- **Topbar** — dark mode persist, search modal, functional ⌘K, navigate ke profile/settings
- **App.tsx** — tambah route `/profile`, `/settings`, init dark mode dari localStorage

### Added (new files)
- `backend/src/services/dashboard.ts`
- `backend/src/controllers/dashboard.ts`
- `backend/src/routes/dashboard.ts`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/components/ui/Toast.tsx` — ToastProvider + context + hook
- `frontend/src/components/ui/ConfirmDialog.tsx`

### Fixed
- Workspace response tidak include tasks → stat cards dashboard selalu 0
- Topbar search hanya placeholder, tidak fungsional
- Sidebar menu mengarah ke route yang tidak ada (task list, calendar)
- Dark mode tidak persist (reset on refresh)
- Attachment URL hardcoded `localhost:4000`
- Hardcoded stat values (overdue: 0, avg completion: 2.4d, trends: +12%/+8%/-5%)
- Socket hanya listen task:updated & task:deleted (11 event lainnya tidak disync)

---

## [1.0.0] — Fase 1: Core MVP

### Added
- **Docker Compose** — PostgreSQL 16 container (`docker compose up -d`)
- **Backend (Express + TypeScript)**
  - Auth: register, login, refresh token (JWT access 15m + refresh 7d httpOnly cookie)
  - Board CRUD (create, read, update, delete)
  - Column CRUD dengan posisi ordering
  - Task CRUD dengan version field untuk optimistic locking
  - Prisma ORM + migration awal
  - Zod validation middleware
  - Error handler middleware
  - Multer file upload config
- **Frontend (React + Vite + TypeScript + Tailwind)**
  - Auth pages: Login, Register
  - Dashboard: list workspace & board, create board
  - Board page: kolom kanban, task cards
  - Drag & drop task antar kolom (@dnd-kit)
  - Zustand store (auth, board state)
  - Axios interceptor untuk auto-refresh token
  - Socket.io client setup
  - API service layer

### Notes
- Register langsung dapet 1 workspace + 1 board + 3 kolom default (To Do, In Progress, Done)
- Drag & drop pake optimistic update + version check (409 → refetch)

---

## [1.1.0] — Fase 2: File Upload, Real-time, Label, Task Detail

### Added
- **Backend**
  - Multer file upload (attachments)
  - Socket.io real-time events untuk task CRUD, comment, assignee, label
  - `emitBoardEvent()` helper dengan board rooms
  - Label CRUD (nama + color hex)
  - Task detail endpoints: comments, attachments, assignees, labels
- **Frontend**
  - TaskCard component dengan label badges, assignee avatars, due date, meta icons
  - ColumnView dengan droppable zone + quick add task
  - TaskModal: edit title/description, date picker, assign/search members, label picker, attachment upload, comments
  - Label management dari board header

---

## [1.2.0] — Fase 3: Activity Log, Role & Permission, Search & Filter, Notifications

### Added
- **Backend**
  - Activity log service: `createLog()`, log tiap aksi (task created/moved/deleted/commented)
  - Notification service + model: notif pas di-assign atau ada comment
  - Role middleware: `requireRole("admin","owner")` dengan lookup otomatis (board/column/task)
  - Member routes: invite (by email), update role, remove
  - Proteksi routes: board/column/label → admin/owner, task → member+
  - Aktivitas log endpoint `GET /boards/:id/activity`
  - Notifikasi endpoint `GET /notifications`, `PATCH /:id/read`, `PATCH /read-all`
- **Frontend**
  - Activity log panel (slide panel di board page)
  - Notifikasi bell dropdown di topbar + board page (unread badge, mark read, mark all read)
  - Search bar + filter (by label, by assignee)
  - Members panel dengan invite by email
  - Halaman Dashboard pake Layout wrapper

---

## [2.0.0] — UI/UX Redesign (TailAdmin-inspired)

### Changed
- **Desain ulang total** — dari dark theme (bg-gray-900/800) ke clean light theme (bg-gray-50, card putih, border halus)
- **Layout global** — Sidebar kiri collapsible + Topbar + konten utama
- **Design system** — Warna brand `#465FFF`, font Inter, border `gray-200`, shadow halus, rounded-xl card
- **Dashboard** — 4 stat cards (Total Tasks, Completed, Overdue, Avg Completion), board list dengan card style
- **Board page** — Breadcrumb, task count chips, search bar, filter bar, improved column & task cards
- **TaskCard** — Design card putih/border, label badges, avatar stack, deadline warna (merah overdue/kuning ≤1 hari), icon lucide (Calendar, MessageSquare, Paperclip)
- **TaskModal** — Form lebih kaya: title edit, date picker, assign member (searchable), label picker, description, attachment list, comments (avatar + bubble), footer Cancel/Save
- **Dark mode** — Native class-based, toggle di topbar

### Added
- `lucide-react` — icons
- `recharts` — chart library (dipakai nanti)
- `@headlessui/react` — accessible UI primitives
- Komponen baru:
  - `<Sidebar />` — collapsible, menu navigasi, logo
  - `<Topbar />` — search, dark mode toggle, notifikasi dropdown, avatar + user menu
  - `<Layout />` — wrapper sidebar + topbar + main content
  - `<StatCard />` — card statistik dengan icon, trend, color variant
  - `<Badge />` — label chip dengan warna custom
  - `<AvatarStack />` — tumpukan avatar (max 3 + "+N")

### Fixed
- CSS `@import` urutan (harus sebelum `@tailwind`)
- Dashboard: `c.tasks?.length || 0` untuk handle undefined tasks (workspace response gak include tasks)
