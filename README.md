# EditFrame — Setup Guide

A full-stack video/image editor with local AI object removal (MobileSAM + LaMa, running entirely on-device via ONNX).

## Prerequisites

- Node.js 20+
- PostgreSQL
- Redis (optional — only needed for background workers)
- A Cloudinary account (free tier is fine)

---

## 1. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../editframe
npm install
```

---

## 2. AI models (required for object removal — NOT included in the repo)

The AI models are **not committed to Git** because of their size (~240 MB total). You must download them manually and place them in `backend/models/`.

Create the folder first:

```bash
cd backend
mkdir models
```

Then download these **three** files and rename them exactly as shown:

| Download | Save into `backend/models/` as | Approx size |
|---|---|---|
| LaMa inpainting model — `lama_fp32.onnx` from [Carve/LaMa-ONNX](https://huggingface.co/Carve/LaMa-ONNX/tree/main) | `lama_fp32.onnx` | ~200 MB |
| MobileSAM encoder ONNX — from [vietanhdev/segment-anything-onnx-models](https://huggingface.co/vietanhdev/segment-anything-onnx-models/tree/main) (or the MobileSAM-in-the-Browser sources) | `mobilesam.encoder.onnx` | ~27 MB |
| MobileSAM decoder ONNX — same source as the encoder | `mobilesam.decoder.onnx` | ~16 MB |

> **Important:** the filenames must match exactly (`lama_fp32.onnx`, `mobilesam.encoder.onnx`, `mobilesam.decoder.onnx`). The download sources may name them differently — rename after downloading.

Your folder should end up looking like this:

```
backend/
  models/
    lama_fp32.onnx
    mobilesam.encoder.onnx
    mobilesam.decoder.onnx
```

### Verify the models work

```bash
cd backend
node test-lama-local.js      # should print: Local LaMa is working!
node test-mobilesam.js       # should print: MobileSAM is working!
```

If either script reports a missing file, double-check the filename and that it's inside `backend/models/`.

---

## 3. Environment variables

Create `backend/.env` (this file is gitignored — never commit it):

```env
# Database
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/editframe

# Auth — use long random strings
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Server
NODE_ENV=development
PORT=4000

# Cloudinary (from your Cloudinary dashboard)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Redis (optional — only for background workers)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# FFmpeg temp dir (Windows example; use /tmp on macOS/Linux)
FFMPEG_TEMP_DIR=C:/editframe-temp
```

Create `editframe/.env`:

```env
VITE_API_URL=http://localhost:4000/api
VITE_WS_URL=ws://localhost:4000/ws
```

> **Note:** AI object removal runs locally and does **not** require any API key. No Replicate account or key is needed.

---

## 4. Database setup

```bash
cd backend
npx prisma migrate dev
```

---

## 5. Run

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd editframe
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:4000

---

## AI object removal — how it works

All AI runs **locally and offline** via ONNX (no cloud, no cost):

1. **Detect** — click an object; MobileSAM segments it
2. **Refine** — brush to add, erase to subtract from the selection
3. **Remove** — LaMa inpaints the masked region
4. **Save** — as a new copy or replace the original

---

## Troubleshooting

- **"model not found"** — a file is missing or misnamed in `backend/models/`. Re-check step 2.
- **Backend won't pick up `.env` changes** — `node --watch` doesn't reload `.env`. Stop (Ctrl+C) and restart.
- **`onnxruntime-node` errors** — run `npm install onnxruntime-node` in `backend/`.