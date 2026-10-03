import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createRoomServer } from "../server/index.js";
import { MemoryStore } from "../server/store.js";
test("real HTTP and WebSocket clients enforce origins, authentication and private views", async () => {
  const origin = "http://localhost:5173",
    app = await createRoomServer(new MemoryStore(), [origin]);
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const address = app.server.address() as { port: number },
    base = "http://127.0.0.1:" + address.port;
  const sockets: WebSocket[] = [];
  try {
    assert.equal((await fetch(base + "/healthz")).status, 200);
    const denied = await fetch(base + "/api/rooms", {
      method: "POST",
      headers: {
        Origin: "https://unauthorized.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(denied.status, 403);
    const create = await fetch(base + "/api/rooms", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Максим", creature: "MANIPUL" }),
    });
    assert.equal(create.status, 201);
    const a = (await create.json()) as any;
    const joined = await fetch(base + "/api/rooms/" + a.view.code + "/join", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Олена", creature: "TRADOR" }),
    });
    const b = (await joined.json()) as any;
    await app.manager.execute(a.view.code, a.playerId, "bot", 2, {
      type: "addBot",
    });
    await app.manager.execute(a.view.code, a.playerId, "start", 3, {
      type: "start",
    });
    for (const creds of [a, b]) {
      const ws = new WebSocket(base.replace("http", "ws") + "/ws", {
        headers: { Origin: origin },
      });
      sockets.push(ws);
      await once(ws, "open");
      const message = once(ws, "message");
      ws.send(
        JSON.stringify({
          type: "authenticate",
          code: a.view.code,
          token: creds.token,
        }),
      );
      const [data] = await message;
      const view = JSON.parse(data.toString()).view;
      assert.equal(view.selfId, creds.playerId);
      assert.equal(view.game.self.hand.length, 4);
      assert(!("credentials" in view));
      assert(!("rng" in view.game));
      assert(
        view.game.players.every((p: any) => !("hand" in p) && !("goals" in p)),
      );
    }
    const invalid = new WebSocket(base.replace("http", "ws") + "/ws", {
      headers: { Origin: origin },
    });
    sockets.push(invalid);
    await once(invalid, "open");
    const fail = once(invalid, "message");
    invalid.send(
      JSON.stringify({
        type: "authenticate",
        code: a.view.code,
        token: "x".repeat(43),
      }),
    );
    assert.equal(JSON.parse((await fail)[0].toString()).type, "error");
  } finally {
    for (const ws of sockets) ws.terminate();
    await app.close();
  }
});
test("an expired room reports a fatal error without crashing the server", async () => {
  const origin = "http://localhost:5173",
    app = await createRoomServer(new MemoryStore(), [origin]);
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const address = app.server.address() as { port: number },
    base = "http://127.0.0.1:" + address.port;
  let ws: WebSocket | undefined;
  try {
    const a = await app.manager.create("Максим", "MANIPUL");
    ws = new WebSocket(base.replace("http", "ws") + "/ws", {
      headers: { Origin: origin },
    });
    await once(ws, "open");
    const authenticated = once(ws, "message");
    ws.send(
      JSON.stringify({
        type: "authenticate",
        code: a.view.code,
        token: a.token,
      }),
    );
    await authenticated;
    await app.manager.pump(Date.now() + 86400001);
    const result = once(ws, "message"),
      closed = once(ws, "close");
    ws.send(JSON.stringify({ type: "sync" }));
    const error = JSON.parse((await result)[0].toString());
    assert.equal(error.type, "error");
    assert.equal(error.fatal, true);
    assert(!error.view);
    assert.equal((await closed)[0], 1008);
    assert.equal((await fetch(base + "/healthz")).status, 200);
  } finally {
    ws?.terminate();
    await app.close();
  }
});
