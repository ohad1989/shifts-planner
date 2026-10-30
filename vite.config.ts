import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createStore, isDataName, type DataStore } from "./server/storage";

// data/ is private (git-ignored). A fresh clone starts from data-example/.
// The backend is chosen by DATA_STORE (sqlite by default, or json).
const DATA_DIR = path.resolve(import.meta.dirname, "data");
const EXAMPLE_DIR = path.resolve(import.meta.dirname, "data-example");

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function dataApi(): Plugin {
  // Opened on first request so `vite build` never touches the database.
  let store: DataStore | undefined;
  const getStore = () => (store ??= createStore({ dataDir: DATA_DIR, exampleDir: EXAMPLE_DIR }));

  const handler = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
    next: () => void,
  ) => {
    const url = req.url ?? "";
    const match = url.match(/^\/api\/data\/([a-z]+)\.json(?:\?.*)?$/);
    if (!match) {
      next();
      return;
    }
    const name = match[1];
    if (!isDataName(name)) {
      res.statusCode = 400;
      res.end("Unknown data file");
      return;
    }
    try {
      if (req.method === "GET") {
        const data = await getStore().get(name);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(`${JSON.stringify(data, null, 2)}\n`);
        return;
      }
      if (req.method === "PUT") {
        const data: unknown = JSON.parse(await readBody(req));
        await getStore().put(name, data);
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
    name: "data-api",
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
  plugins: [react(), dataApi()],
});
