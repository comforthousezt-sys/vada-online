import {
  createServer as httpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { pathToFileURL } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import { RoomManager } from "./rooms.js";
import { FileStore, MemoryStore, PostgresStore } from "./store.js";
import { RuleError } from "../shared/engine.js";
import type { RoomStore, RoomCommand } from "./rooms.js";
import { RULES_VERSION } from "../shared/content.js";
interface Client {
  code: string;
  playerId: string;
  ws: WebSocket;
  alive: boolean;
  count: number;
  window: number;
}
export function allowedOrigin(origin: unknown, allowed: Set<string>) {
  return typeof origin === "string" && allowed.has(origin);
}
function reply(
  res: ServerResponse,
  status: number,
  data: unknown,
  origin?: string,
) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(origin
      ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
      : {}),
  });
  res.end(JSON.stringify(data));
}
async function readBody(req: IncomingMessage) {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 8192) throw new RuleError("Запит завеликий.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RuleError("Некоректний запит.");
  }
}
export async function createRoomServer(
  store: RoomStore,
  origins: string[],
  timers: ConstructorParameters<typeof RoomManager>[1] = {},
) {
  const allowed = new Set(origins),
    manager = new RoomManager(store, timers);
  await manager.initialize();
  const clients = new Set<Client>(),
    httpRates = new Map<string, { count: number; window: number }>();
  const server = httpServer(async (req, res) => {
    const origin = req.headers.origin;
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (req.method === "GET" && path === "/healthz") {
      reply(res, 200, {
        ok: true,
        rulesVersion: RULES_VERSION,
        persistence: store.kind,
      });
      return;
    }
    if (!allowedOrigin(origin, allowed)) {
      reply(res, 403, { error: "Ця адреса сайту не дозволена на сервері." });
      return;
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": origin!,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        Vary: "Origin",
      });
      res.end();
      return;
    }
    if (req.method !== "POST") {
      reply(res, 404, { error: "Такого маршруту немає." }, origin);
      return;
    }
    const ip = req.socket.remoteAddress ?? "unknown",
      now = Date.now(),
      rate = httpRates.get(ip);
    if (!rate || now - rate.window > 60000)
      httpRates.set(ip, { count: 1, window: now });
    else if (++rate.count > 30) {
      reply(
        res,
        429,
        { error: "Забагато запитів. Зачекайте хвилину." },
        origin,
      );
      return;
    }
    try {
      const body = await readBody(req);
      if (!body || typeof body !== "object")
        throw new RuleError("Некоректний запит.");
      if (path === "/api/rooms") {
        reply(res, 201, await manager.create(body.name, body.creature), origin);
        return;
      }
      const match = path.match(/^\/api\/rooms\/([A-F0-9]{6})\/join$/);
      if (match) {
        reply(
          res,
          201,
          await manager.join(match[1], body.name, body.creature),
          origin,
        );
        return;
      }
      reply(res, 404, { error: "Кімнату або маршрут не знайдено." }, origin);
    } catch (e) {
      reply(
        res,
        e instanceof RuleError ? 400 : 503,
        {
          error:
            e instanceof RuleError
              ? e.message
              : "Збереження тимчасово недоступне. Повторіть дію пізніше.",
        },
        origin,
      );
    }
  });
  server.requestTimeout = 15000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  server.on("upgrade", (req, socket, head) => {
    if (
      new URL(req.url ?? "/", "http://localhost").pathname !== "/ws" ||
      !allowedOrigin(req.headers.origin, allowed)
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    if (clients.size >= 600) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  const send = (ws: WebSocket, data: unknown) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  };
  manager.onChange = (code) => {
    for (const c of clients)
      if (c.code === code && c.playerId)
        send(c.ws, {
          type: "view",
          view: manager.view(code, c.playerId),
          serverTime: Date.now(),
        });
  };
  wss.on("connection", (ws) => {
    const c: Client = {
      code: "",
      playerId: "",
      ws,
      alive: true,
      count: 0,
      window: Date.now(),
    };
    clients.add(c);
    const authTimeout = setTimeout(() => {
      if (!c.playerId) ws.close(1008, "Authentication required");
    }, 10000);
    ws.on("pong", () => {
      c.alive = true;
    });
    ws.on("error", () => {});
    ws.on("close", () => {
      clearTimeout(authTimeout);
      clients.delete(c);
    });
    ws.on("message", async (raw) => {
      let id: string | undefined;
      try {
        const now = Date.now();
        if (now - c.window > 60000) {
          c.window = now;
          c.count = 0;
        }
        if (++c.count > 90)
          throw new RuleError("Забагато дій. Зачекайте хвилину.");
        const m = JSON.parse(raw.toString());
        id = typeof m.id === "string" ? m.id : undefined;
        if (m.type === "authenticate") {
          if (c.playerId) throw new RuleError("Місце вже підтверджено.");
          if (typeof m.code !== "string" || !/^[A-F0-9]{6}$/.test(m.code))
            throw new RuleError("Некоректний код кімнати.");
          await manager.refresh(m.code);
          c.playerId = manager.authenticate(m.code, m.token);
          c.code = m.code;
          clearTimeout(authTimeout);
          send(ws, {
            type: "view",
            view: manager.view(c.code, c.playerId),
            serverTime: Date.now(),
          });
          return;
        }
        if (!c.playerId)
          throw new RuleError("Спочатку підтвердіть місце гравця.");
        if (m.type === "command") {
          const result = await manager.execute(
            c.code,
            c.playerId,
            m.id,
            m.version,
            m.command as RoomCommand,
          );
          send(ws, {
            type: "ack",
            id: m.id,
            ...result,
            serverTime: Date.now(),
          });
        } else if (m.type === "chat") {
          await manager.chat(c.code, c.playerId, m.id, m.text);
          send(ws, { type: "chatAck", id: m.id });
        } else if (m.type === "sync") {
          await manager.refresh(c.code);
          send(ws, {
            type: "view",
            view: manager.view(c.code, c.playerId),
            serverTime: Date.now(),
          });
        } else throw new RuleError("Невідомий запит.");
      } catch (e) {
        let view,
          expired = false;
        if (c.playerId)
          try {
            view = manager.view(c.code, c.playerId);
          } catch {
            expired = true;
          }
        send(ws, {
          type: "error",
          id,
          error: expired
            ? "Термін кімнати завершився. Створіть нову партію."
            : e instanceof RuleError
              ? e.message
              : "Сервер не підтвердив дію. Перевірте зв’язок і повторіть.",
          view,
          fatal: expired,
          serverTime: Date.now(),
        });
        if (expired) {
          c.code = "";
          c.playerId = "";
          ws.close(1008, "Room expired");
        }
      }
    });
  });
  const pump = setInterval(() => {
    void manager.pump().catch(() => {});
  }, 900);
  const heartbeat = setInterval(() => {
    for (const c of clients) {
      if (!c.alive) {
        c.ws.terminate();
        continue;
      }
      c.alive = false;
      c.ws.ping();
    }
    for (const [ip, rate] of httpRates)
      if (Date.now() - rate.window > 60000) httpRates.delete(ip);
  }, 30000);
  return {
    server,
    manager,
    async close() {
      clearInterval(pump);
      clearInterval(heartbeat);
      for (const c of clients) c.ws.close(1012, "Service restarting");
      await manager.drain();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await store.close();
    },
  };
}
async function boot() {
  const origins = (process.env.ALLOWED_ORIGINS ?? "http://127.0.0.1:5173")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!origins.length || origins.some((x) => new URL(x).origin !== x))
    throw new Error("ALLOWED_ORIGINS must contain exact origins without paths");
  const onRender = process.env.RENDER === "true";
  if (
    onRender &&
    !process.env.DATABASE_URL &&
    process.env.ALLOW_EPHEMERAL !== "true"
  )
    throw new Error(
      "Set DATABASE_URL for durable rooms, or explicitly set ALLOW_EPHEMERAL=true for a disposable demo",
    );
  const store: RoomStore = process.env.DATABASE_URL
    ? new PostgresStore(
        process.env.DATABASE_URL,
        process.env.DATABASE_SSL_CA_BASE64,
      )
    : onRender
      ? new MemoryStore()
      : new FileStore(process.env.DATA_DIR ?? "./data");
  const seconds = (name: string, defaultValue: number) => {
    const n = Number(process.env[name] ?? defaultValue);
    if (!Number.isInteger(n) || n < 5 || n > 600)
      throw new Error("Invalid timer " + name);
    return n * 1000;
  };
  const app = await createRoomServer(store, origins, {
    turn: seconds("TURN_SECONDS", 30),
    proposal: seconds("PROPOSAL_SECONDS", 30),
    debate: seconds("DEBATE_SECONDS", 120),
    vote: seconds("VOTE_SECONDS", 30),
  });
  const port = Number(process.env.PORT ?? 10000);
  app.server.listen(port, "0.0.0.0", () => {
    console.log(
      "VADA room server ready on port " + port + "; persistence=" + store.kind,
    );
  });
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    void app.close().then(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void boot().catch((e) => {
    // Log only the short machine error code. Messages, stacks and URL inputs
    // may contain database credentials and must never reach deployment logs.
    const code =
      e instanceof Error &&
      "code" in e &&
      typeof e.code === "string" &&
      /^[A-Z0-9_]{2,64}$/.test(e.code)
        ? e.code
        : "UNKNOWN";
    console.error(
      e instanceof Error && e.message.startsWith("Set DATABASE_URL")
        ? e.message
        : `VADA startup failed [${code}]. Check origins, database connection, schema and instance count.`,
    );
    process.exitCode = 1;
  });
