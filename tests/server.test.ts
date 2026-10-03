import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RoomManager } from "../server/rooms.js";
import { FileStore, MemoryStore } from "../server/store.js";
async function playing(store = new MemoryStore()) {
  const m = new RoomManager(store);
  await m.initialize();
  const a = await m.create("Максим", "MANIPUL");
  const b = await m.join(a.view.code, "Олена", "TRADOR");
  await m.execute(a.view.code, a.playerId, "bot1", 2, { type: "addBot" });
  await m.execute(a.view.code, a.playerId, "start1", 3, { type: "start" });
  return { m, a, b, store };
}
test("credentials are hashed and room code cannot authenticate another player", async () => {
  const { m, a, b } = await playing();
  assert.equal(m.authenticate(a.view.code, a.token), a.playerId);
  assert.equal(m.authenticate(a.view.code, b.token), b.playerId);
  assert.throws(() => m.authenticate(a.view.code, "x".repeat(43)));
  assert(!JSON.stringify(m.rooms.get(a.view.code)).includes(a.token));
  assert(
    !JSON.stringify(m.view(a.view.code, b.playerId)).includes("credentials"),
  );
});
test("replayed operations apply once; stale and changed-ID payloads are rejected", async () => {
  const { m, a } = await playing();
  const version = m.view(a.view.code, a.playerId).version;
  const result = await m.execute(a.view.code, a.playerId, "travel1", version, {
    type: "travel",
    steps: 1,
    buy: true,
  });
  const duplicate = await m.execute(
    a.view.code,
    a.playerId,
    "travel1",
    version,
    { type: "travel", steps: 1, buy: true },
  );
  assert.equal(result.view.game!.players[0].coins, 320);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.view.game!.totalTurns, 1);
  await assert.rejects(
    m.execute(a.view.code, a.playerId, "travel2", version, { type: "pass" }),
    /змінився/,
  );
  await assert.rejects(
    m.execute(a.view.code, a.playerId, "travel1", version, { type: "pass" }),
    /іншої/,
  );
});
test("a failed persistence write neither changes state nor acknowledges the action", async () => {
  const { m, a, store } = await playing();
  const before = m.view(a.view.code, a.playerId);
  store.failNext = true;
  await assert.rejects(
    m.execute(a.view.code, a.playerId, "failed", before.version, {
      type: "pass",
    }),
    /storage/,
  );
  assert.deepEqual(m.view(a.view.code, a.playerId), before);
});
test("simultaneous spending commands serialize and cannot purchase twice", async () => {
  const { m, a } = await playing();
  const version = m.view(a.view.code, a.playerId).version;
  const results = await Promise.allSettled(
    ["x", "y"].map((id) =>
      m.execute(a.view.code, a.playerId, id, version, {
        type: "travel",
        steps: 1,
        buy: true,
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(m.view(a.view.code, a.playerId).game!.totalTurns, 1);
});
test("server restart restores state, credentials, secrets, deadlines and operation deduplication", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vada-room-"));
  try {
    const m = new RoomManager(new FileStore(dir));
    await m.initialize();
    const a = await m.create("Максим", "PACTA");
    await m.execute(a.view.code, a.playerId, "bot1", 1, { type: "addBot" });
    await m.execute(a.view.code, a.playerId, "bot2", 2, { type: "addBot" });
    await m.execute(a.view.code, a.playerId, "start", 3, { type: "start" });
    const before = m.view(a.view.code, a.playerId),
      full = m.rooms.get(a.view.code)!;
    const reboot = new RoomManager(new FileStore(dir));
    await reboot.initialize();
    assert.equal(reboot.authenticate(a.view.code, a.token), a.playerId);
    assert.deepEqual(reboot.view(a.view.code, a.playerId), before);
    assert.equal(reboot.rooms.get(a.view.code)!.game!.rng, full.game!.rng);
    const dup = await reboot.execute(a.view.code, a.playerId, "start", 3, {
      type: "start",
    });
    assert.equal(dup.duplicate, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
