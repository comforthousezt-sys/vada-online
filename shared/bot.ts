import { ASSETS, LAWS, card } from "./content.js";
import { stepsTo } from "./engine.js";
import type { Command, GameView } from "./types.js";
export function chooseBotCommand(v: GameView): Command | null {
  const me = v.players.find((p) => p.id === v.self.id)!;
  const owned = ASSETS.filter((a) => v.assets[a.id].owner === me.id);
  if (v.phase === "finished") return null;
  if (v.phase === "reaction") {
    if (v.reaction!.target !== me.id) return null;
    const defense = v.self.hand
      .map(card)
      .find(
        (c) =>
          c?.type === "counter" &&
          (c.counters?.includes("all") ||
            c.counters?.includes(v.reaction!.cardId)) &&
          (c.id !== "veil" || me.influence > 0),
      );
    return { type: "react", cardId: defense?.id };
  }
  if (v.phase === "proposal") {
    if (v.ready.includes(me.id)) return null;
    if (
      v.attendance.includes(me.id) &&
      v.proposals.length < 2 &&
      me.influence > 0
    ) {
      const best = LAWS.filter(
        (l) => !v.proposals.some((p) => p.lawId === l.id),
      )
        .map((l) => ({
          l,
          score: l.group
            ? owned.filter((a) => a.group === l.group).length
            : l.id === "solidarity" && owned.length <= 1
              ? 1
              : 0,
        }))
        .sort((a, b) => b.score - a.score)[0];
      if (best && best.score > 0) return { type: "propose", lawId: best.l.id };
    }
    return { type: "ready" };
  }
  if (v.phase === "debate")
    return v.ready.includes(me.id) ? null : { type: "ready" };
  if (v.phase === "vote") {
    const proposal = v.proposals[v.voteIndex];
    if (!v.attendance.includes(me.id) || proposal.ownVote) return null;
    const l = LAWS.find((l) => l.id === proposal.lawId)!;
    const good = l.group
      ? owned.some((a) => a.group === l.group) || owned.length === 0
      : l.id === "integrity"
        ? me.scandals === 0
        : owned.length <= 1;
    return { type: "vote", vote: good ? "yes" : "no" };
  }
  if (v.players[v.turnIndex].id !== me.id) return null;
  const remaining = 10 - (v.totalTurns % 10);
  if (remaining <= v.players.length && me.position !== null)
    return { type: "return" };
  if (
    me.creature === "TRADOR" &&
    me.influence >= 2 &&
    me.whisperDay !== v.day &&
    me.coins < 200
  )
    return { type: "whisper" };
  if (
    me.creature === "RHETOR" &&
    me.influence >= 2 &&
    me.whisperDay !== v.day &&
    v.self.hand.length <= 3
  )
    return { type: "whisper" };
  if (v.self.hand.includes("grant") && me.coins < 250)
    return { type: "card", cardId: "grant" };
  if (v.self.hand.includes("cleanup") && me.scandals)
    return { type: "card", cardId: "cleanup" };
  const available = ASSETS.filter(
    (a) =>
      !v.assets[a.id].owner &&
      a.price <= me.coins &&
      stepsTo(me.position, a.tile) >= 1 &&
      stepsTo(me.position, a.tile) <= 3,
  );
  available.sort(
    (a, b) =>
      (v.self.goals.includes(b.group) ? 5 : 0) +
      b.points -
      (v.self.goals.includes(a.group) ? 5 : 0) -
      a.points,
  );
  if (available.length)
    return {
      type: "travel",
      steps: stepsTo(me.position, available[0].tile),
      buy: true,
    };
  const here = ASSETS.find((a) => a.tile === me.position);
  if (
    here &&
    v.assets[here.id].owner === me.id &&
    v.assets[here.id].level < 2 &&
    me.coins >= 200
  )
    return { type: "upgrade" };
  if (remaining > v.players.length && ASSETS.some((a) => !v.assets[a.id].owner))
    return { type: "travel", steps: 3, buy: false };
  if (me.influence >= 2 && me.whisperDay !== v.day) {
    if (me.creature === "PACTA" && !me.ward) return { type: "whisper" };
    if (me.creature === "MANIPUL")
      return {
        type: "whisper",
        targetId: v.players
          .filter((p) => p.id !== me.id)
          .sort((a, b) => b.influence - a.influence)[0].id,
      };
  }
  if (v.self.hand.includes("dividend") && owned.length >= 2)
    return { type: "card", cardId: "dividend" };
  if (v.self.hand.includes("speculation"))
    return { type: "card", cardId: "speculation" };
  return { type: "pass" };
}
