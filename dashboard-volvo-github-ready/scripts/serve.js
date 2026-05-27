const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requestedPort = Number(process.env.PORT || 8080);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const target = decoded === "/" ? "/index.html" : decoded;
  const resolved = path.resolve(root, `.${target}`);
  return resolved.startsWith(root) ? resolved : null;
}

function createServer(port) {
  const server = http.createServer((req, res) => {
    const filePath = safePath(req.url || "/");
    if (!filePath) {
      send(res, 403, "Acceso no permitido", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        send(res, 404, "Archivo no encontrado", { "Content-Type": "text/plain; charset=utf-8" });
        return;
      }

      const ext = path.extname(filePath);
      send(res, 200, content, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
    });
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") createServer(port + 1);
    else throw error;
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Dashboard disponible en http://127.0.0.1:${port}`);
  });
}

createServer(requestedPort);
