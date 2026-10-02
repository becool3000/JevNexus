import http from "node:http";
import { repoDecide, repoEvidence } from "./repo-decide.mjs";
import { GitNexusMcpSource } from "./gitnexus-mcp.mjs";

const host = process.env.JEVNEXUS_HOST || "127.0.0.1";
const port = Number(process.env.JEVNEXUS_PORT || 4850);
const gitnexus = new GitNexusMcpSource();

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024 * 1024) throw new Error("Request body exceeds 1 MiB.");
  }
  return body ? JSON.parse(body) : {};
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, { ok: true, service: "jevnexus", gitnexus: await gitnexus.health() });
      return;
    }
    if (request.method === "POST" && request.url === "/repo_decide") {
      const body = await readJson(request);
      if (typeof body.question !== "string" || !body.question.trim()) {
        sendJson(response, 400, { ok: false, error: "question must be a non-empty string." });
        return;
      }
      const result = await repoDecide(body.question, body.choices, body.decisionType, {
        source: gitnexus,
        queryLimit: body.queryLimit,
        searchLimit: body.searchLimit,
        expansionLimit: body.expansionLimit,
        graphDepth: body.graphDepth,
        maxEvidenceChars: body.maxEvidenceChars,
        includeContext: body.debug === true || body.includeContext === true,
        recordDiagnostics: body.recordDiagnostics === true,
      });
      sendJson(response, 200, result);
      return;
    }
    if (request.method === "POST" && request.url === "/evidence") {
      const body = await readJson(request);
      if (typeof body.question !== "string" || !body.question.trim()) {
        sendJson(response, 400, { ok: false, error: "question must be a non-empty string." });
        return;
      }
      const result = await repoEvidence(body.question, {
        source: gitnexus,
        queryLimit: body.queryLimit,
        searchLimit: body.searchLimit,
        expansionLimit: body.expansionLimit,
        graphDepth: body.graphDepth,
        maxEvidenceChars: body.maxEvidenceChars,
        recordDiagnostics: body.recordDiagnostics === true,
      });
      sendJson(response, 200, result);
      return;
    }
    if (request.method === "POST" && request.url === "/shutdown") {
      sendJson(response, 200, { ok: true, status: "shutting_down" });
      setTimeout(async () => {
        await gitnexus.stop();
        server.close(() => process.exit(0));
      }, 25);
      return;
    }
    sendJson(response, 404, { ok: false, error: "Not found." });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message });
  }
});

async function start() {
  await gitnexus.start();
  server.listen(port, host, () => {
    console.log(`JEVNEXUS_WARM_SERVER_READY:${host}:${port}`);
  });
}

async function stop() {
  await gitnexus.stop();
  server.close(() => process.exit(0));
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
start().catch(async (error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  await gitnexus.stop();
  process.exit(1);
});
