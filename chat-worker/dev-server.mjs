/**
 * Local mock server for the widget. Does not call Anthropic.
 *   MOCK=1 node dev-server.mjs
 * Enquiry posts to /enquiry-test are accepted only here, so the fallback
 * form can be tried without emailing anyone.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { handle } from "./src/logic.js";

const knowledge = readFileSync(new URL("../knowledge/zapsite.md", import.meta.url), "utf8");
const port = Number(process.env.PORT || 8787);
const env = Object.assign({ MOCK: "1", MODEL: "claude-haiku-5-5" }, process.env);

function corsFor(origin) {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    Vary: "Origin"
  };
}

createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.url.startsWith("/enquiry-test")) {
    const headers = Object.assign({ "content-type": "application/json; charset=utf-8" }, corsFor(origin));
    if (req.method === "OPTIONS") {
      res.writeHead(204, headers);
      res.end();
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    let body = {};
    try { body = JSON.parse(raw || "{}"); } catch { body = {}; }
    const keys = Object.keys(body).sort();
    console.log(JSON.stringify({ enquiry: true, keys }));
    res.writeHead(200, headers);
    res.end(JSON.stringify({ success: "true", message: "Stored locally. Nothing was emailed." }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const request = new Request("http://127.0.0.1:" + port + req.url, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body
  });
  const response = await handle(request, env, knowledge);
  const out = {};
  response.headers.forEach((value, key) => { out[key] = value; });
  res.writeHead(response.status, out);
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ listening: port, mock: true }));
});
