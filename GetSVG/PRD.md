# Product Requirements Document — GetSVG Chrome Extension

**Version:** 1.0  
**Date:** 2026-05-29  
**Status:** Draft

---

## 1. Overview

GetSVG (nama resmi, bukan "SVG Grabber") adalah Chrome Extension yang memungkinkan designer dan developer untuk mengambil file SVG dari halaman web secara instan — baik via klik kanan langsung di elemen SVG, maupun melalui panel highlight yang menampilkan semua SVG di halaman.

---

## 2. Problem Statement

Mengambil SVG dari sebuah website saat ini sangat menyulitkan:

- Harus buka DevTools, inspect element, cari tag `<svg>` atau URL `.svg`, lalu copy manual
- Banyak website memblokir klik kanan, membuat proses makin lambat
- Untuk desainer yang hanya butuh sebuah logo atau ilustrasi, proses ini tidak proporsional dengan kebutuhannya
- SVG yang di-inline (bukan file terpisah) tidak bisa di-download langsung dari network tab

Target pengguna: **UI/UX Designer** dan **Frontend Developer** yang rutin bekerja dengan aset visual dari web.

---

## 3. Goals & Success Metrics

### Goals
- Mempercepat proses grab SVG dari menit menjadi detik
- Mendukung semua metode embed SVG yang umum: inline `<svg>`, `<img src=".svg">`, `background-image: url(".svg")`, `use href`
- Bekerja bahkan di website yang memblokir klik kanan

### Success Metrics
- Time-to-grab SVG < 5 detik (dari halaman terbuka hingga SVG di clipboard/folder)
- Berhasil mendeteksi SVG di 95%+ website populer
- Rating ≥ 4.5 di Chrome Web Store dalam 3 bulan pertama

---

## 4. Features

### 4.1 Context Menu — Grab SVG via Klik Kanan

**Trigger:** User klik kanan di atas elemen SVG (inline atau `<img>` yang source-nya `.svg`)

**Behavior:**
- Muncul item menu: **"Copy SVG"** dan **"Download SVG"**
- **Copy SVG** → menyalin raw SVG markup ke clipboard. User bisa paste langsung ke Figma, Illustrator, CorelDraw, dll.
- **Download SVG** → menyimpan file `.svg` ke folder Downloads (atau folder yang dikonfigurasi user)

**Edge cases:**
- Jika SVG tidak punya atribut `xmlns`, extension menambahkannya otomatis agar valid
- Jika SVG adalah `<use href>`, extension resolve ke definisi aslinya
- Jika website override klik kanan, extension tetap bekerja via injected listener (bukan native `contextmenu`)

---

### 4.2 SVG Highlighter

**Trigger:** Klik icon extension di toolbar, atau shortcut keyboard (misal `Alt+Shift+S`)

**Behavior:**
- Semua elemen SVG di halaman ditandai dengan overlay berwarna (default: biru transparan dengan border)
- Tooltip muncul saat hover: nama file (jika ada), dimensi, dan method embed
- Klik pada highlight → munculkan mini popup dengan dua tombol: **Copy** dan **Download**

**Toggle:** Klik icon extension lagi atau tekan shortcut → highlight hilang

---

### 4.3 Extension Popup Panel

**Trigger:** Klik icon GetSVG di toolbar Chrome

**Behavior:**
- Menampilkan daftar semua SVG yang terdeteksi di halaman aktif
- Setiap item menampilkan: thumbnail preview, dimensi, dan method embed (`inline`, `img`, `bg`, `use`)
- Aksi per item: **Copy** | **Download**
- Tombol **"Download All"** → download semua SVG di halaman sebagai `.zip`
- Tombol **"Highlight All"** → toggle SVG Highlighter (lihat 4.2)

---

### 4.4 Copy Format Options

Di settings, user dapat memilih format saat Copy:
- **SVG Markup** (default) — raw `<svg>...</svg>`
- **Data URI** — `data:image/svg+xml;base64,...` (berguna untuk CSS)
- **Optimized SVG** — jalankan SVGO (client-side) sebelum copy, untuk mengurangi ukuran file

---

## 5. Out of Scope (v1.0)

- Export ke format lain (PNG, PDF, WebP)
- Batch rename sebelum download
- Cloud sync atau history
- Support browser selain Chrome / Chromium-based (Firefox, Safari)
- SVG yang di-render via Canvas

---

## 6. Technical Requirements

### Detection Strategy
Extension harus mampu mendeteksi SVG dari berbagai sumber:

| Method | Selector / Approach |
|---|---|
| Inline SVG | `document.querySelectorAll('svg')` |
| `<img>` tag | `img[src$=".svg"], img[src*=".svg?"]` |
| CSS background | Parse computed style `background-image` |
| `<use>` reference | Resolve `href` / `xlink:href` ke `<symbol>` atau external file |
| Object/embed | `object[type="image/svg+xml"]`, `embed[src$=".svg"]` |

### Permissions Required (manifest.json)
```json
"permissions": ["activeTab", "contextMenus", "downloads", "scripting", "storage"]
"host_permissions": ["<all_urls>"]
```

### Architecture
- **Manifest V3** (wajib untuk Chrome Web Store submission 2024+)
- Content Script: injeksi ke setiap tab untuk deteksi dan highlight SVG
- Service Worker (background): handle download, context menu registration
- Popup: React + Tailwind (atau Vanilla JS untuk bundle size kecil)

### SVG Cleaning sebelum Copy/Download
- Tambahkan `xmlns="http://www.w3.org/2000/svg"` jika tidak ada
- Strip `<script>` tags untuk keamanan
- Preserve `viewBox`, dimensi, dan semua path data

---

## 7. UX & Design Principles

- **Neobrutalism:** Gaya desain UI menggunakan Neobrutalism — bold borders, flat colors, strong shadows, tipografi tegas. Berlaku untuk popup panel, highlighter overlay, dan tooltip.
- **Zero friction:** Tidak ada login, tidak ada onboarding panjang. Install → langsung pakai.
- **Always-on context menu:** Klik kanan di atas SVG langsung menampilkan opsi Copy/Download — tidak perlu aktivasi apapun dari toolbar.
- **Opt-in Highlighter:** Overlay highlight hanya aktif saat user klik icon toolbar secara manual — tidak autorun karena intrusif.
- **Fast:** Semua operasi (copy, highlight scan) harus selesai < 500ms
- **Familiar:** Gunakan pola UX yang sudah dikenal — klik kanan dan toolbar icon sebagai dua entry point utama.

---

## 8. User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-01 | Designer | Klik kanan SVG dan pilih "Copy SVG" | Saya bisa paste ke Figma tanpa buka DevTools |
| US-02 | Developer | Download SVG langsung ke folder lokal | Saya punya file asset tanpa proses manual |
| US-03 | Designer | Lihat semua SVG di halaman sekaligus | Saya bisa menemukan logo atau ilustrasi yang saya cari |
| US-04 | Developer | Download semua SVG di halaman sebagai ZIP | Saya bisa grab semua asset icon sekaligus |
| US-05 | Designer | Copy SVG dalam format Data URI | Saya bisa langsung pakai di CSS atau HTML inline |
| US-06 | User | Highlight mana saja yang SVG di halaman | Saya tahu persis elemen mana yang bisa di-grab |

---

## 9. Milestones

| Milestone | Deliverable | Target |
|---|---|---|
| M1 — Core | Context menu Copy + Download untuk inline SVG & `<img src=".svg">` | Week 2 |
| M2 — Detection | Full SVG detection (bg, use, object/embed) | Week 4 |
| M3 — Highlighter | Overlay highlight + hover tooltip | Week 5 |
| M4 — Popup Panel | Daftar SVG + thumbnail + Download All | Week 7 |
| M5 — Polish | SVGO optimization, settings page, icons | Week 8 |
| M6 — Launch | Chrome Web Store submission | Week 9 |

---

## 10. Open Questions

1. **Nama final:** ✅ **GetSVG** (ditetapkan). Di deskripsi Store gunakan "GetSVG — SVG Grabber for Designers & Developers" untuk menangkap keyword pencarian.
2. **Monetisasi:** ✅ **Freemium + one-time Pro upgrade.** Fitur Pro: Download All as ZIP, SVGO optimization, copy sebagai Data URI.
3. **SVGO:** ✅ **Client-side bundle, fitur Pro.** Lebih private, tidak ada server dependency.
4. **Keyboard shortcut:** ✅ **Deprioritize untuk v1.** Bukan backbone product — UX difokuskan mouse-first (context menu + toolbar icon). Bisa ditambah di versi berikutnya jika ada user request.
