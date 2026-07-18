import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

/*
 * Capture the raw request body for every method/content-type so it can be
 * forwarded verbatim to the upstream x402 endpoint. We deliberately avoid
 * parsing it — the inspector sends whatever the user typed.
 */
app.use((req, res, next) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });
  req.on("error", next);
});

// Hop-by-hop headers (RFC 7230 §6.1) plus host — never forward these upstream.
const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "accept-encoding",
  // proxy-control headers used by the frontend, not meant for upstream
  "x-proxy-url",
]);

const STRIP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

/*
 * GET/POST/PUT/DELETE /proxy — forward the request to the URL given in the
 * `x-proxy-url` header (or `?url=`). Because the browser now talks to this
 * same-origin proxy, CORS never applies and *all* upstream response headers
 * (payment-required, payment-response, etc.) are visible to the frontend.
 */
app.all("/proxy", async (req, res) => {
  const target = req.get("x-proxy-url") || req.query.url;

  if (!target) {
    res.status(400).json({ error: "Missing target URL (x-proxy-url header or ?url=)." });
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    res.status(400).json({ error: `Invalid target URL: ${target}` });
    return;
  }
  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    res.status(400).json({ error: "Only http and https targets are allowed." });
    return;
  }

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers[key] = value;
    }
  }

  const hasBody = req.rawBody && req.rawBody.length > 0;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? req.rawBody : undefined,
      redirect: "manual",
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(502).json({
      error: "Upstream request failed.",
      detail: err?.message || String(err),
    });
  }
});

// Serve the static frontend.
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`x402 inspector running at http://localhost:${PORT}`);
});
