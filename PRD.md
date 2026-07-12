# PRD — Kanban Project Manager

## 1. Ringkasan Eksekutif
Website manajemen proyek berbasis papan **Kanban** yang mendukung multi-user dengan sistem login, drag & drop task antar kolom, penugasan anggota tim, deadline, lampiran file, komentar, label prioritas, serta kemampuan menambahkan kolom kustom sesuai kebutuhan tim.

## 2. Latar Belakang & Tujuan
- Tim membutuhkan alat kolaborasi visual untuk melacak progres pekerjaan secara real-time.
- Tujuan utama: mempermudah tracking task, transparansi progres antar anggota, dan mengurangi miskomunikasi.
- Dibangun custom agar bisa disesuaikan bebas (kolom custom, integrasi ke depan, dsb) dibanding pakai tools SaaS pihak ketiga.

## 3. Target Pengguna
| Role | Deskripsi |
|---|---|
| Admin/Owner | Membuat board, mengatur workspace, kelola user |
| Project Manager | Membuat/mengatur task, assign anggota, atur deadline |
| Member | Mengerjakan task, update status, komentar, upload lampiran |
| Viewer (opsional) | Hanya bisa melihat board, tanpa edit |

## 4. Ruang Lingkup

### 4.1 In Scope (v1.0)
- Autentikasi multi-user (register, login, logout, reset password)
- Manajemen Workspace/Board (buat, edit, hapus, multi-board per user)
- Kolom kanban dinamis (default: To Do, In Progress, Done — **user bisa tambah/hapus/rename kolom sendiri**)
- Task/Card:
  - Drag & drop antar kolom (dan reorder dalam kolom)
  - Assign ke satu atau lebih anggota tim
  - Deadline / due date + reminder
  - Label/tag prioritas (Low, Medium, High, Urgent — bisa custom warna)
  - Komentar per task (multi-user, real-time)
  - Lampiran file (upload dokumen/gambar)
  - Deskripsi & checklist sub-task (opsional v1)
- Notifikasi dasar (task di-assign ke saya, deadline mendekat, ada komentar baru)
- Riwayat aktivitas (activity log) per board

### 4.2 Out of Scope (v1.0 — dipertimbangkan untuk v2)
- Integrasi kalender eksternal (Google Calendar, dsb)
- Automasi/workflow rules (misal: auto-move task saat semua checklist selesai)
- Aplikasi mobile native (fokus web responsive dulu)
- Reporting/analytics dashboard mendalam (burndown chart, dsb)
- Integrasi Slack/Discord notification

## 5. Fitur Utama (Functional Requirements)

| ID | Fitur | Prioritas |
|---|---|---|
| F-01 | Register/Login/Logout (JWT-based auth) | Must |
| F-02 | CRUD Workspace & Board | Must |
| F-03 | CRUD Kolom (custom, reorder kolom) | Must |
| F-04 | CRUD Task/Card | Must |
| F-05 | Drag & drop task antar kolom & reorder | Must |
| F-06 | Assign anggota tim ke task (multi-assignee) | Must |
| F-07 | Set deadline pada task + indikator overdue | Must |
| F-08 | Label/prioritas dengan warna custom | Must |
| F-09 | Komentar pada task | Must |
| F-10 | Upload & lihat lampiran file pada task | Must |
| F-11 | Notifikasi in-app (assign, deadline, komentar) | Should |
| F-12 | Activity log per board | Should |
| F-13 | Role & permission (Admin/PM/Member/Viewer) | Should |
| F-14 | Search & filter task (by assignee, label, deadline) | Should |
| F-15 | Checklist sub-task dalam card | Could |

## 6. User Stories (contoh)
- Sebagai **PM**, saya ingin membuat board baru dan menambahkan kolom custom (misal "Review", "QA") agar alur kerja tim sesuai proses kami.
- Sebagai **Member**, saya ingin memindahkan task dengan drag & drop agar status pekerjaan langsung ter-update untuk semua orang.
- Sebagai **Anggota tim**, saya ingin di-assign ke sebuah task dan menerima notifikasi agar tahu tanggung jawab saya.
- Sebagai **PM**, saya ingin memberi label prioritas "Urgent" pada task kritikal agar mudah terlihat.
- Sebagai **Member**, saya ingin melampirkan file desain ke task agar referensi tersimpan di satu tempat.
- Sebagai **siapa saja di board**, saya ingin berkomentar di task untuk diskusi tanpa keluar dari platform.

## 7. Non-Functional Requirements
- **Performance**: Update drag & drop harus terasa instan (<200ms optimistic update di UI, sinkron ke server di background).
- **Realtime**: Perubahan board (task pindah, komentar baru) tampil ke user lain tanpa refresh (via WebSocket).
- **Security**: Password di-hash (bcrypt), JWT dengan refresh token, validasi input di backend, role-based access control.
- **Scalability**: Struktur data mendukung banyak board & task per workspace tanpa degradasi signifikan.
- **Availability**: Backend stateless agar mudah di-scale horizontal.
- **Usability**: Responsive (desktop utama, tablet minimal supported).

## 8. Tech Stack (Ringkasan — detail lihat DESAIN.md)
- Frontend: **React.js** (Vite) + drag-and-drop library + state management
- Backend: Node.js (Express) REST API + WebSocket (Socket.io) untuk realtime
- Database: PostgreSQL (relasional, cocok untuk relasi board-column-task-user yang kompleks)
- Auth: JWT + bcrypt
- File storage: Local disk (dev) / S3-compatible (production)

## 9. Metrik Keberhasilan
- Task dapat dipindah drag & drop tanpa lag/error
- Multi-user bisa login & bekerja di board yang sama secara bersamaan (realtime sync)
- Tidak ada data hilang saat concurrent update (race condition tertangani)
- Waktu load board < 1 detik untuk board dengan ~100 task

## 10. Risiko & Mitigasi
| Risiko | Mitigasi |
|---|---|
| Race condition saat drag & drop bersamaan oleh 2 user | Gunakan optimistic locking / versioning pada task, broadcast via WebSocket |
| Upload file besar membebani server | Batasi ukuran file, gunakan storage terpisah (S3-compatible) |
| Kompleksitas custom kolom tak terbatas | Batasi jumlah kolom per board (misal maks 15) untuk jaga performa UI |
| Scope creep (fitur v2 masuk ke v1) | PRD ini jadi acuan; fitur v2 didaftarkan terpisah |

## 11. Roadmap Bertahap
1. **Fase 1 — Core**: Auth, Board/Kolom CRUD, Task CRUD, Drag & drop
2. **Fase 2 — Kolaborasi**: Assign anggota, komentar, lampiran, label prioritas
3. **Fase 3 — Polish**: Notifikasi, activity log, role & permission, search/filter
4. **Fase 4 (v2, opsional)**: Automasi, analytics, integrasi eksternal
