import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = resolve(projectRoot, "public");
const port = Number(process.env.PORT || 3002);
const messages = [];
const maxMessages = 500;
const maxBodyBytes = 16 * 1024;

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".ico", "image/x-icon"]
]);

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBodyBytes) {
      const error = new Error("Размер запроса превышает допустимый предел.");
      error.status = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Тело запроса должно быть корректным JSON.");
    error.status = 400;
    throw error;
  }
}

async function serveStatic(pathname, response) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(publicRoot, `.${decodeURIComponent(requestedPath)}`);
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const contents = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes.get(extname(filePath)) || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(contents);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    throw error;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (url.pathname === "/api/messages" && request.method === "GET") {
      const limit = Number(url.searchParams.get("limit") || 100);
      if (!Number.isInteger(limit) || limit < 1 || limit > maxMessages) {
        sendJson(response, 400, { error: `Параметр limit должен быть числом от 1 до ${maxMessages}.` });
        return;
      }
      sendJson(response, 200, messages.slice(-limit));
      return;
    }

    if (url.pathname === "/api/messages" && request.method === "POST") {
      const payload = await readJson(request);
      const sender = typeof payload?.sender === "string" ? payload.sender.trim() : "";
      const text = typeof payload?.text === "string" ? payload.text.trim() : "";

      if (!sender || sender.length > 60) {
        sendJson(response, 400, { error: "Имя отправителя должно содержать от 1 до 60 символов." });
        return;
      }
      if (!text || text.length > 2000) {
        sendJson(response, 400, { error: "Сообщение должно содержать от 1 до 2000 символов." });
        return;
      }

      const message = {
        id: randomUUID(),
        sender,
        text,
        receivedAt: new Date().toISOString()
      };
      messages.push(message);
      if (messages.length > maxMessages) messages.shift();
      sendJson(response, 201, message);
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      sendJson(response, 404, { error: "Маршрут API не найден." });
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end("Method Not Allowed");
      return;
    }
    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error("Ошибка запроса:", error);
    if (error.status) {
      sendJson(response, error.status, { error: error.message });
      return;
    }
    sendJson(response, 500, { error: "Внутренняя ошибка сервера." });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Демо доступно: http://localhost:${port}`);
  console.log("Сообщения хранятся только в памяти и исчезнут после остановки Node.js.");
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
