# SVGrabber — Developer Guide

## Prerequisites

Install dulu sebelum mulai:
- [Node.js](https://nodejs.org) (v18+)
- [VSCode](https://code.visualstudio.com)
- Google Chrome

VSCode extensions yang disarankan:
- **ESLint** — linting
- **Prettier** — auto format
- **Chrome Debugger** (built-in di VSCode modern)

---

## 1. Setup Project

```bash
# Buat folder project
mkdir svgrabber && cd svgrabber

# Init npm
npm init -y

# Install dev dependencies
npm install -D vite @crxjs/vite-plugin typescript
```

Struktur folder awal:
```
svgrabber/
├── src/
│   ├── background/
│   │   └── index.ts        # Service Worker
│   ├── content/
│   │   └── index.ts        # Content Script (injeksi ke halaman)
│   ├── popup/
│   │   ├── index.html
│   │   └── index.ts        # Panel popup
│   └── manifest.json
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 2. Konfigurasi manifest.json

```json
{
  "manifest_version": 3,
  "name": "SVGrabber",
  "version": "1.0.0",
  "description": "Grab any SVG from any webpage instantly.",
  "permissions": ["activeTab", "contextMenus", "downloads", "scripting", "storage"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["src/content/index.ts"]
  }],
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": "icons/icon48.png"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

## 3. Development Workflow

### Jalankan dev server
```bash
npm run dev
```

Vite + CRXJS akan watch perubahan file dan rebuild otomatis.

### Load extension ke Chrome
1. Buka Chrome → `chrome://extensions`
2. Aktifkan **Developer mode** (toggle kanan atas)
3. Klik **"Load unpacked"**
4. Pilih folder `dist/` hasil build
5. Extension muncul di toolbar

### Setiap kali ada perubahan code:
- Vite auto-rebuild
- Di `chrome://extensions`, klik tombol **refresh** (ikon reload) di card SVGrabber
- Reload tab yang sedang ditest

---

## 4. Urutan Build Fitur

Ikuti urutan ini agar selalu ada sesuatu yang bisa ditest:

### Tahap 1 — Context Menu (Core)
- Register context menu di `background/index.ts`
- Detect apakah elemen yang diklik kanan adalah SVG
- Implement "Copy SVG" → kirim ke clipboard
- Implement "Download SVG" → simpan sebagai file

### Tahap 2 — Full SVG Detection
- Di `content/index.ts`, tulis fungsi `detectAllSVGs()`
- Cover semua method: inline `<svg>`, `<img src=".svg">`, CSS background, `<use>`

### Tahap 3 — Highlighter
- Inject overlay `<div>` di atas setiap SVG yang terdeteksi
- Toggle on/off via pesan dari popup ke content script
- Tambahkan hover tooltip (dimensi, method embed)

### Tahap 4 — Popup Panel
- Tampilkan daftar SVG hasil `detectAllSVGs()`
- Thumbnail preview per item
- Tombol Copy dan Download per item
- Tombol "Highlight All" dan "Download All"

### Tahap 5 — Pro Features
- Download All as ZIP (gunakan library `jszip`)
- SVGO optimization (bundle `svgo` client-side)
- Copy sebagai Data URI

---

## 5. Testing

Tidak ada framework test khusus untuk extension, jadi testing dilakukan manual:

**Test site yang disarankan:**
- `github.com` — banyak SVG inline (icon Octicons)
- `figma.com` — SVG kompleks
- `stripe.com` — ilustrasi SVG berkualitas tinggi
- Cari website yang block klik kanan untuk test edge case

**Checklist per fitur:**
- [ ] Copy SVG → paste ke Figma, cek apakah render benar
- [ ] Download SVG → buka file di browser, cek valid
- [ ] Highlight → semua SVG terdeteksi, tidak ada false positive
- [ ] Popup panel → daftar akurat sesuai halaman

---

## 6. Build untuk Production

```bash
npm run build
```

Output di folder `dist/`. Folder inilah yang di-zip untuk disubmit ke Chrome Web Store.

```bash
# Zip untuk submission
cd dist && zip -r ../svgrabber.zip .
```

---

## 7. Submit ke Chrome Web Store

1. Buka [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Bayar one-time developer fee: **$5**
3. Upload `svgrabber.zip`
4. Isi deskripsi, screenshot, kategori (`Developer Tools`)
5. Submit untuk review — biasanya 1–3 hari kerja

---

## Referensi

- [Chrome Extension MV3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin)
- [SVGO](https://github.com/svg/svgo)
- [JSZip](https://stuk.github.io/jszip/)
