# 🩺 MedScan AI — Prescription Decoder & Medication Assistant

> Snap a photo of a messy handwritten prescription → get a structured, readable medication schedule with reminders, drug-interaction warnings, and multilingual support.

Built for **Vihaan X — Software Track (HealthTech)**.

![status](https://img.shields.io/badge/status-hackathon--ready-brightgreen)
![stack](https://img.shields.io/badge/stack-React%20%2B%20Node-blue)
![deps](https://img.shields.io/badge/backend%20deps-zero-success)

---

## ✨ Features

- 📸 **Upload / snap a prescription** — drag & drop or phone camera.
- 🤖 **AI-powered decoding** — extracts medicine name, dosage, frequency, duration, and food instructions.
- 🗓️ **Auto-generated schedule** — turns timings like `1-0-1`, `BD`, `HS` into a clean Morning → Night plan.
- ⚠️ **Drug-interaction warnings** — flags risky combinations (e.g. Warfarin + Aspirin) with severity.
- 🌐 **Multilingual output** — reads back instructions in English and Hindi (easily extensible).
- 💡 **Care notes** — per-medicine cautions (take after food, complete the course, etc.).
- 🧪 **Demo-safe** — works fully offline with a realistic mock engine, and upgrades to real AI the moment you add an API key.

---

## ⚡ Quick Start (zero install)

The backend and the static frontend server use **only Node.js built-ins** — no `npm install` required.

```bash
# from the medscan-ai/ folder
./start.sh
```

Then open **http://localhost:5173**.

Or start the two pieces manually:

```bash
# terminal 1 — backend API (port 5000)
node server/index.js

# terminal 2 — frontend (port 5173)
node client/serve.js
```

> Requires Node.js 18+ (uses the built-in `fetch` and `node:http`).

---

## 🏗️ Architecture

```
medscan-ai/
├── start.sh              # one-command launcher (backend + frontend)
├── server/               # zero-dependency Node API
│   ├── index.js              # HTTP server + routes + multipart parser
│   ├── services/
│   │   ├── aiParser.js       # real OpenAI vision  ·  offline mock fallback
│   │   └── scheduleBuilder.js# parses "1-0-1" / "BD" / "HS" into time slots
│   └── data/
│       ├── drugInteractions.js # interaction KB + brand→generic aliases
│       └── translations.js     # multilingual instruction builder
└── client/               # React (CDN) single-page app
    ├── index.html            # loads React + Tailwind from CDN
    ├── app.js                # the whole UI (JSX, transpiled in-browser)
    └── serve.js              # zero-dependency static file server
```

### AI strategy (why the demo never fails)
The backend tries a **real vision model** when `OPENAI_API_KEY` is set. If there's no key
(or the call fails for any reason), it falls back to a deterministic **mock engine** that
returns realistic prescriptions. The output shape is identical either way, so the UI doesn't
care. This is deliberate — a live hackathon demo should never break on a flaky network.

The UI shows a small badge (**Live AI** vs **Demo engine**) so you're always transparent about which path ran.

---

## 🔌 Enabling real AI (optional)

1. Get an OpenAI API key with vision access.
2. Create `server/.env` (copy from `.env.example`) and set:
   ```
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   ```
3. Restart the backend. It now sends uploaded images to the vision model for real OCR + parsing,
   and the badge flips to **Live AI**.

Check which mode is active any time:
```bash
curl http://localhost:5000/api/health
# { "aiMode": "mock" }  or  { "aiMode": "live" }
```

---

## 🧪 API reference

| Method | Endpoint             | Body                                   | Returns |
|--------|----------------------|----------------------------------------|---------|
| GET    | `/api/health`        | —                                      | status + aiMode |
| POST   | `/api/scan`          | multipart `prescription=<image>` **or** JSON `{ "demo": true }` | full parsed result |
| POST   | `/api/interactions`  | JSON `{ "medicines": [{ "name": "..." }] }` | interaction warnings |

**Example — run the sample without an image:**
```bash
curl -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" -d '{"demo":true}'
```

**Example — check a risky combo:**
```bash
curl -X POST http://localhost:5000/api/interactions \
  -H "Content-Type: application/json" \
  -d '{"medicines":[{"name":"Warf 5"},{"name":"Ecosprin 75"}]}'
```

---

## 🎯 Demo script (2 minutes)

1. "Handwritten prescriptions are unreadable — patients, especially the elderly, miss doses."
2. Click **Try with a sample prescription** (or drag in a photo) → watch it decode live.
3. Point to the **🛡️ Safety check** — "It automatically caught a risky drug interaction."
4. Point to the **🗓️ schedule** — "Morning, afternoon, night — auto-generated from `1-0-1` notation."
5. Toggle **हिन्दी** on the medicines — "Accessible to everyone, in their own language."
6. "Zero external dependencies, runs anywhere, and plugs into real AI with one key. Thank you."

---

## 🛠️ Extending it

- **More languages:** add an entry to `DICT` in `server/data/translations.js` and to `SUPPORTED_LANGUAGES`.
- **More interactions:** add pairs to `INTERACTIONS` and aliases to `DRUG_ALIASES` in `server/data/drugInteractions.js`.
- **Real reminders:** wire the schedule into a cron / WhatsApp / push-notification service.
- **Production frontend:** the CDN React setup is great for demos; for production, port `app.js` into a Vite + Tailwind build.

---

## ⚕️ Disclaimer

MedScan AI is a decision-support **demo**, not a substitute for professional medical advice.
Always confirm medications with a licensed pharmacist or doctor.
