# UI/UX.md — Desain Tampilan Kanban Project Manager

Referensi desain: **Figma UI Kit — "3 Free Kanban Board App UI Kit"** (screenshot: Kanban Dashboard).
> Dokumen ini menggantikan versi sebelumnya yang berbasis referensi TailAdmin — sekarang mengikuti gaya kit Figma ini: lebih playful, warna solid per-kolom, badge label berwarna-warni.

## 1. Prinsip Desain
- **Playful & berwarna**: tiap kolom kanban punya warna solid identitas sendiri (bukan abu-abu netral seperti admin dashboard biasa).
- **Card putih bersih di atas background abu muda** — kontras jelas antara card dan kanvas.
- **Badge label warna-warni** untuk kategori/prioritas task, bukan cuma teks polos.
- **Rounded penuh** (pill-shape) untuk tombol, badge, dan header kolom — kesan modern & ramah.
- **Data sosial di tiap card** (avatar tim, jumlah komentar, jumlah views) supaya terasa kolaboratif.

## 2. Design Tokens

| Token | Nilai | Kegunaan |
|---|---|---|
| `--bg-page` | `#F5F6FA` (abu sangat muda) | Background halaman |
| `--bg-sidebar` | `#FFFFFF` | Sidebar |
| `--bg-card` | `#FFFFFF` | Task card |
| `--text-primary` | `#1A1A2E` | Judul task, heading |
| `--text-secondary` | `#8A8FA3` | Deskripsi, meta info |
| `--brand-purple` | `#6C4EF5` | Logo, kolom "In Progress", tombol Share, aksen utama |
| `--col-orange` | `#F5A623` | Kolom "Reviewed" |
| `--col-green` | `#2ECC71` | Kolom "Completed" |
| Radius card | `16px` (rounded-2xl) | Task card |
| Radius pill | `9999px` (rounded-full) | Header kolom, badge, tombol, search bar |
| Font | Inter / system-ui, bold untuk judul | |

### Palet Badge Label (fleksibel per kategori/prioritas)
| Label | Warna badge |
|---|---|
| Important | Ungu muda (`bg-purple-100 text-purple-700`) |
| Meh | Oranye muda |
| OK | Kuning muda |
| High Priority | Merah muda (`bg-red-100 text-red-600`) |
| Low Priority | Hijau muda |
| Maybe important | Peach/salmon muda |
| I don't know | Abu muda |
| Not that important | Pink muda |

> Label bersifat **custom & dinamis** — user bisa membuat label baru dengan teks & warna bebas (bukan cuma prioritas baku), sesuai fleksibilitas yang ditunjukkan di referensi.

## 3. Struktur Layout Global

```
┌───────────────┬───────────────────────────────────────────────────┐
│  Logo + nama   │  Judul Halaman + ikon avatar kecil                │
│  app           │  ─────────────────────────────────────────────── │
│  🔍 Search     │  Tabs: By Status | By Total Tasks(12) | Tasks Due │
│                │        | Extra Tasks | Tasks Completed            │
│  Menu:         │                                    🔍  [Share]    │
│  🏠 Home  (10) │                                    ⬆️   [+]        │
│  ✅ Tasks       ├───────────────────────────────────────────────────┤
│  👥 Users  (2) │                                    Sort By: Newest│
│  🔌 APIs       │                                                    │
│  💳 Subscription│  [Kolom-kolom Kanban] ...                        │
│  ⚙️ Settings   │                                                    │
│  ❓ Help       │                                                    │
│                │                                                    │
│  [Promo Card]  │                                                    │
│  [Avatar user] │                                                    │
└───────────────┴───────────────────────────────────────────────────┘
```

### 3.1 Sidebar (kiri, putih, fixed)
- **Logo** app di atas (ikon + nama, misal ikon huruf inisial dalam kotak ungu)
- **Search bar** pill-shape abu muda dengan ikon kaca pembesar
- **Menu navigasi** dengan ikon + label, beberapa item punya **badge angka bulat** di kanan (misal Home `10`, Users `2`) — badge lingkaran ungu muda/abu
- Item aktif ditandai background pill abu muda + ikon warna gelap
- **Promo card** di bagian bawah sidebar (opsional untuk kita: bisa dipakai untuk info "Upgrade Plan" / tips onboarding) dengan tombol "Dismiss" (teks) dan "Go Pro"/CTA (teks warna brand)
- **Profil user** paling bawah: avatar + nama + role kecil (misal "Basic Member") + ikon logout/expand di kanan

### 3.2 Topbar / Header Halaman
- Judul halaman besar-bold (misal "Kanban Dashboard") + ikon kecil avatar tim di sampingnya
- **Baris tab** di bawah judul untuk filter tampilan: `By Status` (aktif, underline warna brand) · `By Total Tasks` (dengan badge angka total) · `Tasks Due` · `Extra Tasks` · `Tasks Completed`
- Kanan atas: ikon **search**, tombol **Share** (pill ungu solid + ikon share, teks putih), ikon **export/upload**, tombol **+** bulat solid (tambah board/task baru)
- Di bawah tab, rata kanan: dropdown **"Sort By: Newest"**

## 4. Halaman Papan Kanban

### 4.1 Header Kolom (pill penuh berwarna solid)
Setiap kolom punya header berbentuk pill/rounded-2xl penuh warna solid (bukan cuma garis tipis):
- Kiri: **badge bulat putih** berisi jumlah task (angka, teks warna sesuai warna kolom) — misal `25`, `8`, `2`
- Tengah: **nama kolom** teks putih bold (misal "In Progress", "Reviewed", "Completed")
- Kanan: **tombol + bulat** (putih transparan/solid) untuk tambah task langsung ke kolom itu

Warna kolom default (bisa di-custom user saat bikin kolom baru):
- Kolom 1 (misal "In Progress") → ungu (`--brand-purple`)
- Kolom 2 (misal "Reviewed") → oranye (`--col-orange`)
- Kolom 3 (misal "Completed") → hijau (`--col-green`)
- Kolom tambahan custom → user pilih warna dari palet preset

### 4.2 Task Card
Struktur dari atas ke bawah, dalam card putih `rounded-2xl` dengan sedikit shadow:
1. **Badge label** kecil pill di kiri-atas (warna sesuai kategori/prioritas, lihat tabel palet di atas)
2. **Judul task** — bold, hitam, 1-2 baris
3. **Deskripsi singkat** — teks abu, 2 baris, truncate (`...`) kalau kepanjangan
4. **Baris footer card**:
   - Kiri: **avatar stack** anggota yang di-assign (avatar bulat bertumpuk, maks 3 tampil + badge `+N` kalau lebih)
   - Kanan: ikon 💬 + jumlah komentar, ikon 👁️ + jumlah views/dilihat (format angka disingkat: `997`, `21,8k`, `87,2k` untuk task populer/lama)

Drag & drop: card bisa dipindah antar kolom (efek shadow lebih tebal + sedikit scale saat di-drag, kolom tujuan highlight border warnanya).

### 4.3 Modal Tambah/Edit Task
- Judul Task (input)
- Deskripsi (textarea)
- Pilih Kolom/Status (dropdown, preview warna kolom)
- Label (pilih dari label yang ada / buat baru dengan color picker)
- Assignees (multi-select avatar, searchable)
- Due date (date picker) — opsional ditambahkan indikator kalau relevan untuk fitur deadline
- Attachments (upload area + list file)
- Komentar (list + input baru)
- Footer: tombol **Batal** (outline) + **Simpan** (pill solid ungu)

## 5. Komponen Reusable

| Komponen | Deskripsi |
|---|---|
| `<Sidebar />` | Termasuk search, menu dengan badge count, promo card, profil user |
| `<PageHeader tabs={[]} actions={[]} />` | Judul halaman + baris tab filter + tombol aksi kanan |
| `<KanbanColumn color="purple|orange|green|custom" />` | Header pill solid + list task card + tombol tambah task |
| `<TaskCard />` | Badge label, judul, deskripsi, avatar stack, komentar & views count |
| `<LabelBadge text color />` | Badge pill warna dinamis, dipakai di card & modal |
| `<AvatarStack users maxVisible={3} />` | Dipakai di task card & topbar |
| `<SortDropdown options={["Newest","Oldest","Priority"]} />` | Dipakai di atas kolom board |
| `<ShareButton />` | Tombol pill solid ungu dengan ikon share |
| `<TaskModal />` | Form create/edit task |

## 6. Responsif
- **Desktop (≥1280px)**: sidebar terbuka penuh + label, kolom kanban berdampingan (scroll horizontal kalau kolom > 3)
- **Tablet (768–1279px)**: sidebar collapse jadi ikon saja (tanpa label & badge count kecuali di-hover), kolom tetap horizontal scroll
- **Mobile (<768px)**: sidebar jadi drawer/off-canvas (toggle via hamburger di topbar), tab filter jadi scrollable horizontal, kolom kanban ditampilkan satu per satu dengan swipe/tab switch, header kolom tetap pill warna solid full-width

## 7. Library/Tooling untuk Implementasi
- **TailwindCSS** — cocok untuk styling pill-shape, rounded-2xl, warna solid per kolom
- **@dnd-kit/core** — drag & drop task card antar kolom
- **Headless UI / Radix UI** — dropdown (Sort By, menu titik-tiga), modal task, tooltip
- **lucide-react** — ikon search, share, komentar, views/eye, plus, dsb
- **react-avatar** atau komponen custom — untuk avatar stack bertumpuk
