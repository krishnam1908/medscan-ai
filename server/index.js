/**
 * MedScan AI — zero-dependency HTTP server.
 *
 * Uses only Node.js built-ins (http, no Express/Multer) so it runs anywhere
 * with `node index.js` — no `npm install` required. This keeps your hackathon
 * demo bulletproof even on a locked-down or offline machine.
 *
 * Endpoints:
 *   GET  /api/health
 *   POST /api/scan           (multipart image upload OR JSON { demo: true })
 *   POST /api/interactions   (JSON { medicines: [{ name }] })
 */

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { parsePrescription } from "./services/aiParser.js";
import { normalizeMedicine, buildDaySchedule } from "./services/scheduleBuilder.js";
import { checkInteractions } from "./data/drugInteractions.js";
import { buildInstruction, SUPPORTED_LANGUAGES } from "./data/translations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- lightweight .env loader (no dependency) --------------------------------
function loadEnv() {
  const envPath = join(__dirname, ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const PORT = process.env.PORT || 5000;

// ---- helpers ----------------------------------------------------------------

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function readBody(req, limitBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Minimal multipart/form-data parser.
 * Returns { fields: {}, files: [{ name, filename, contentType, data }] }.
 * Good enough for a single image + a few text fields (which is all we need).
 */
function parseMultipart(buffer, boundary) {
  const result = { fields: {}, files: [] };
  const boundaryBuf = Buffer.from(`--${boundary}`);
  let start = buffer.indexOf(boundaryBuf);
  if (start === -1) return result;

  while (start !== -1) {
    const next = buffer.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (next === -1) break;

    // part is between this boundary and the next
    let partStart = start + boundaryBuf.length;
    // skip the trailing CRLF after the boundary line
    if (buffer[partStart] === 0x0d && buffer[partStart + 1] === 0x0a) partStart += 2;

    const headerEnd = buffer.indexOf("\r\n\r\n", partStart, "utf8");
    if (headerEnd === -1) {
      start = next;
      continue;
    }
    const headerText = buffer.toString("utf8", partStart, headerEnd);
    const contentStart = headerEnd + 4;
    // content ends 2 bytes (CRLF) before next boundary
    const contentEnd = next - 2;
    const content = buffer.slice(contentStart, Math.max(contentStart, contentEnd));

    const nameMatch = /name="([^"]*)"/i.exec(headerText);
    const filenameMatch = /filename="([^"]*)"/i.exec(headerText);
    const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headerText);
    const fieldName = nameMatch ? nameMatch[1] : null;

    if (filenameMatch && filenameMatch[1]) {
      result.files.push({
        name: fieldName,
        filename: filenameMatch[1],
        contentType: typeMatch ? typeMatch[1].trim() : "application/octet-stream",
        data: content,
      });
    } else if (fieldName) {
      result.fields[fieldName] = content.toString("utf8");
    }

    start = next;
  }

  return result;
}

// ---- route handlers ---------------------------------------------------------

async function handleScan(req, res) {
  const contentType = req.headers["content-type"] || "";
  let buffer = null;
  let mimeType = "image/jpeg";
  let demoMode = false;

  if (contentType.startsWith("multipart/form-data")) {
    const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
    const boundary = boundaryMatch ? boundaryMatch[1] || boundaryMatch[2] : null;
    const raw = await readBody(req);
    if (boundary) {
      const { fields, files } = parseMultipart(raw, boundary.trim());
      demoMode = fields.demo === "true";
      const file = files.find((f) => f.name === "prescription") || files[0];
      if (file) {
        buffer = file.data;
        mimeType = file.contentType;
      }
    }
  } else if (contentType.includes("application/json")) {
    const raw = await readBody(req);
    try {
      const json = JSON.parse(raw.toString("utf8") || "{}");
      demoMode = json.demo === true || json.demo === "true";
    } catch {
      /* ignore */
    }
  }

  if (!buffer && !demoMode) {
    return sendJson(res, 400, {
      error: "No prescription image uploaded. Send multipart field 'prescription' or JSON { demo: true }.",
    });
  }

  // Pipeline: parse -> normalize -> schedule -> interactions -> translate
  const { source, data } = await parsePrescription(buffer, mimeType);
  const medicines = (data.medicines || []).map(normalizeMedicine);
  const schedule = buildDaySchedule(medicines);
  const { warnings, notes } = checkInteractions(medicines);

  const medicinesWithLang = medicines.map((m) => ({
    ...m,
    instructionsByLang: Object.fromEntries(
      SUPPORTED_LANGUAGES.map((l) => [l.code, buildInstruction(m, l.code)])
    ),
  }));

  sendJson(res, 200, {
    source,
    patient: {
      name: data.patientName || null,
      doctor: data.doctorName || null,
      date: data.date || null,
    },
    medicines: medicinesWithLang,
    schedule,
    interactions: warnings,
    careNotes: notes,
    doctorNotes: data.notes || null,
    languages: SUPPORTED_LANGUAGES,
  });
}

async function handleInteractions(req, res) {
  const raw = await readBody(req);
  let medicines = [];
  try {
    const json = JSON.parse(raw.toString("utf8") || "{}");
    medicines = Array.isArray(json.medicines) ? json.medicines : [];
  } catch {
    /* ignore */
  }
  if (!medicines.length) {
    return sendJson(res, 400, { error: "Provide a non-empty 'medicines' array." });
  }
  const { warnings, notes } = checkInteractions(medicines);
  sendJson(res, 200, { interactions: warnings, careNotes: notes });
}

// ---- server -----------------------------------------------------------------

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === "OPTIONS") {
      return sendJson(res, 204, {});
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        status: "ok",
        service: "MedScan AI",
        aiMode: process.env.OPENAI_API_KEY ? "live" : "mock",
        time: new Date().toISOString(),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/scan") {
      return await handleScan(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/interactions") {
      return await handleInteractions(req, res);
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("[server] error:", err);
    sendJson(res, 500, { error: err.message || "Internal error" });
  }
});

server.listen(PORT, () => {
  const mode = process.env.OPENAI_API_KEY ? "LIVE AI (OpenAI)" : "MOCK (offline-safe)";
  console.log(`\n🩺 MedScan AI server running on http://localhost:${PORT}`);
  console.log(`   AI mode: ${mode}`);
  console.log(`   Health:  http://localhost:${PORT}/api/health\n`);
});
