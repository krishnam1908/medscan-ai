/**
 * Zero-dependency static file server for the MedScan AI client.
 *
 * Usage:  node serve.js  [port]
 * Then open http://localhost:5173
 *
 * This exists so you can serve the frontend without installing anything.
 * (Opening index.html via file:// also works, but a server avoids CORS quirks.)
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.argv[2] || 5173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
    if (urlPath === "/") urlPath = "/index.html";

    // prevent path traversal
    const safePath = normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = join(__dirname, safePath);

    const content = await readFile(filePath);
    const type = MIME[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`\n🖥️  MedScan AI client served at http://localhost:${PORT}`);
  console.log(`   Make sure the backend is running at http://localhost:5000\n`);
});
