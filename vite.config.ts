import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(import.meta.dirname, "data");
const ALLOWED = new Set([
  "settings.json",
  "people.json",
  "templates.json",
  "weeks.json",
]);

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function dataFileApi(): Plugin {
  const handler = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
    next: () => void,
  ) => {
    const url = req.url ?? "";
    const match = url.match(/^\/api\/data\/([a-z]+\.json)(?:\?.*)?$/);
    if (!match) {
      next();
      return;
    }
    const file = match[1];
    if (!ALLOWED.has(file)) {
      res.statusCode = 400;
      res.end("Unknown data file");
      return;
    }
    const full = path.join(DATA_DIR, file);
    try {
    if (req.method === "GET") {
      const json = fs.readFileSync(full, "utf8");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(json);
      return;
    }
    if (req.method === "PUT") {
      const body = await readBody(req);
      JSON.parse(body);
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = `${full}.tmp`;
      fs.writeFileSync(tmp, body.endsWith("\n") ? body : `${body}\n`, "utf8");
      fs.renameSync(tmp, full);
      res.statusCode = 204;
      res.end();
      return;
    }
    res.statusCode = 405;
    res.end();
    } catch (err) {
      res.statusCode = 500;
      res.end(err instanceof Error ? err.message : String(err));
    }
  };

  return {
    name: "data-file-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handler(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handler(req, res, next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), dataFileApi()],
});
