import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  applyCommand,
  viewFor,
  tick,
  scoreGame,
} from "../shared/engine.js";
import { chooseBotCommand } from "../shared/bot.js";
import {
  ASSETS,
  CARDS,
  CREATURES,
  EVENTS,
  GOALS,
  LAWS,
} from "../shared/content.js";
import type { GameState, Command, Seat } from "../shared/types.js";
const seats: Seat[] = CREATURES.slice(0, 4).map((c, i) => ({
  id: "p" + i,
  name: "Гравець " + i,
  creature: c.id,
  bot: true,
}));
function fresh() {
  return createGame(seats, 45, 1000);
}
function run(s: GameState, id: string, c: Command) {
  return applyCommand(s, id, c, 1000);
}
test("content has exactly 30 named cards across four categories and 12 assets", () => {
  assert.equal(CARDS.filter((c) => c.type === "action").length, 12);
  assert.equal(CARDS.filter((c) => c.type === "counter").length, 8);
  assert.equal(CARDS.length + LAWS.length + EVENTS.length, 30);
  assert.equal(ASSETS.length, 12);
  assert.equal(GOALS.length, 10);
});
test("the tenth shared turn fixes attendance and does not reset the queue", () => {
  let s = fresh();
  s = run(s, "p0", { type: "travel", steps: 1, buy: true });
  for (let i = 1; i < 10; i++)
    s = run(s, s.players[s.turnIndex].id, { type: "pass" });
  assert.equal(s.totalTurns, 10);
  assert.equal(s.phase, "proposal");
  assert.equal(s.turnIndex, 2);
  assert(!s.attendance.includes("p0"));
  assert.equal(s.assets.market.owner, "p0");
  assert.throws(
    () => run(s, "p0", { type: "propose", lawId: "trade_relief" }),
    /парламент/,
  );
});
test("the client never receives other hands, secret objectives, deck or RNG", () => {
  const s = fresh(),
    v = viewFor(s, "p0"),
    raw = JSON.stringify(v);
  assert.equal(v.self.hand.length, 4);
  assert.equal(v.self.goals.length, 2);
  assert(!("hand" in v.players[1]));
  assert(!("goals" in v.players[1]));
  assert(!("rng" in v));
  assert(!("deck" in v));
  assert(!raw.includes('"discard"'));
});
test("invalid travel and purchases cannot mutate a source state", () => {
  const s = fresh(),
    raw = JSON.stringify(s);
  assert.throws(() => run(s, "p0", { type: "travel", steps: 0, buy: true }));
  assert.throws(
    () => run(s, "p1", { type: "travel", steps: 1, buy: true }),
    /черга/,
  );
  assert.equal(JSON.stringify(s), raw);
});
test("absent players cannot vote and a four-player law needs three yes votes", () => {
  let s = fresh();
  s = run(s, "p0", { type: "travel", steps: 1, buy: false });
  for (let i = 1; i < 10; i++)
    s = run(s, s.players[s.turnIndex].id, { type: "pass" });
  s = run(s, "p1", { type: "propose", lawId: "trade_relief" });
  for (const p of seats) s = run(s, p.id, { type: "ready" });
  for (const p of seats) s = run(s, p.id, { type: "ready" });
  assert.equal(s.phase, "vote");
  assert.throws(() => run(s, "p0", { type: "vote", vote: "yes" }), /парламент/);
  s = run(s, "p1", { type: "vote", vote: "yes" });
  s = run(s, "p2", { type: "vote", vote: "yes" });
  s = run(s, "p3", { type: "vote", vote: "abstain" });
  assert.equal(s.phase, "turn");
  assert.equal(s.lawHistory[0].passed, false);
  assert.equal(s.day, 2);
});
test("reaction blocks an attack and advances only one turn", () => {
  let s = fresh();
  s.players[0].hand = ["rumor"];
  s.players[1].hand = ["shield"];
  s = run(s, "p0", { type: "card", cardId: "rumor", targetId: "p1" });
  assert.equal(s.phase, "reaction");
  assert.equal(s.totalTurns, 0);
  assert.throws(() => run(s, "p2", { type: "react" }));
  s = run(s, "p1", { type: "react", cardId: "shield" });
  assert.equal(s.players[1].scandals, 0);
  assert.equal(s.totalTurns, 1);
  assert.equal(s.turnIndex, 1);
});
test("trade is bilateral, private, atomic and revalidates resources", () => {
  let s = fresh();
  s.assets.market.owner = "p0";
  s.assets.studio.owner = "p1";
  s = run(s, "p0", {
    type: "offer",
    to: "p1",
    giveCoins: 50,
    takeCoins: 20,
    giveAsset: "market",
    takeAsset: "studio",
    offerId: "offer1",
  });
  assert.equal(viewFor(s, "p2").offers.length, 0);
  assert.throws(() => run(s, "p2", { type: "acceptOffer", offerId: "offer1" }));
  s = run(s, "p1", { type: "acceptOffer", offerId: "offer1" });
  assert.equal(s.assets.market.owner, "p1");
  assert.equal(s.assets.studio.owner, "p0");
  assert.equal(s.players[0].coins, 370);
  assert.equal(s.players[1].coins, 430);
  assert.throws(() => run(s, "p1", { type: "acceptOffer", offerId: "offer1" }));
  let t = fresh();
  t = run(t, "p0", {
    type: "offer",
    to: "p1",
    giveCoins: 400,
    takeCoins: 0,
    offerId: "offer2",
  });
  t.players[0].coins = 10;
  assert.throws(
    () => run(t, "p1", { type: "acceptOffer", offerId: "offer2" }),
    /монет/,
  );
  assert.equal(t.players[1].coins, 400);
});
test("untrusted asset IDs cannot poison offers or asset-targeted cards", () => {
  const s = fresh();
  s.assets.market.owner = "p0";
  s.assets.studio.owner = "p1";
  s.players[0].hand = ["renovate", "sabotage"];
  const before = JSON.stringify(s);
  for (const value of [
    ["market"],
    { toString: "market" },
    null,
    "",
    "unknown",
  ]) {
    assert.throws(() =>
      run(s, "p0", {
        type: "offer",
        to: "p1",
        giveCoins: 0,
        takeCoins: 0,
        giveAsset: value,
        offerId: "bad",
      } as unknown as Command),
    );
    assert.throws(() =>
      run(s, "p0", {
        type: "card",
        cardId: "renovate",
        assetId: value,
      } as unknown as Command),
    );
  }
  assert.throws(() =>
    run(s, "p0", {
      type: "card",
      cardId: "sabotage",
      targetId: "p1",
      assetId: ["studio"],
    } as unknown as Command),
  );
  assert.equal(JSON.stringify(s), before);
});
test("all 3-, 4- and 5-player bot matches reach exactly six sessions and 60 turns", () => {
  for (const n of [3, 4, 5])
    for (let seed = 1; seed <= 12; seed++) {
      let s = createGame(
        CREATURES.slice(0, n).map((c, i) => ({
          id: "p" + i,
          name: c.id,
          creature: c.id,
          bot: true,
        })),
        seed,
        1000,
      );
      for (let i = 0; i < 1000 && s.phase !== "finished"; i++) {
        const p =
          s.phase === "reaction"
            ? s.reaction!.target
            : s.phase === "turn"
              ? s.players[s.turnIndex].id
              : s.phase === "vote"
                ? s.attendance.find(
                    (id) => !(id in s.proposals[s.voteIndex].votes),
                  )
                : s.players.find((p) => !s.ready.includes(p.id))?.id;
        if (!p) {
          s = tick(s, s.deadline + 1);
          continue;
        }
        const command = chooseBotCommand(viewFor(s, p));
        s = command ? run(s, p, command) : tick(s, s.deadline + 1);
      }
      assert.equal(s.phase, "finished", "seed " + seed + " players " + n);
      assert.equal(s.totalTurns, 60);
      assert.equal(s.day, 6);
      assert.equal(s.scores.length, n);
      assert(
        s.players.every(
          (p) =>
            p.coins >= 0 &&
            p.influence >= 0 &&
            p.influence <= 6 &&
            p.hand.length <= 6,
        ),
      );
    }
});
test("final score excludes future income and exposes objectives only after finishing", () => {
  const s = fresh();
  s.players[0].coins = 400;
  s.players[0].lawsPassed = 2;
  s.players[0].goals = ["estate", "laws"];
  s.players[0].scandals = 1;
  s.assets.market.owner = "p0";
  s.assets.studio.owner = "p0";
  s.assets.forge.owner = "p0";
  s.assets.market.level = 1;
  const scores = scoreGame(s);
  const me = scores.find((x) => x.playerId === "p0")!;
  assert.equal(me.assetPoints, 6);
  assert.equal(me.coinPoints, 2);
  assert.equal(me.lawPoints, 4);
  assert.equal(me.goalPoints, 6);
  assert.equal(me.total, 17);
});
