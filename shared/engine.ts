import {
  ASSETS,
  CARDS,
  EVENTS,
  GOALS,
  RULES_VERSION,
  card,
  law,
} from "./content.js";
import type {
  GameState,
  GameView,
  Player,
  Seat,
  Timers,
  Command,
  Score,
  Offer,
} from "./types.js";

export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}
function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RuleError(message);
}
function addLog(s: GameState, text: string) {
  s.log.push({ id: (s.log.at(-1)?.id ?? 0) + 1, day: s.day, text });
  if (s.log.length > 300) s.log.shift();
}
function random(s: GameState) {
  let x = s.rng || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
function shuffle<T>(s: GameState, arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function draw(s: GameState, p: Player, n: number) {
  for (let i = 0; i < n && p.hand.length < 6; i++) {
    if (!s.deck.length) s.deck = shuffle(s, s.discard.splice(0));
    const c = s.deck.pop();
    if (c) p.hand.push(c);
  }
}
function influence(p: Player, n: number) {
  p.influence = Math.min(6, Math.max(0, p.influence + n));
}
function scandal(p: Player, n: number) {
  p.scandals = Math.min(3, Math.max(0, p.scandals + n));
}
function setPhase(s: GameState, phase: GameState["phase"], now: number) {
  s.phase = phase;
  const ms = phase === "finished" ? 0 : s.timers[phase];
  s.deadline = ms > 0 ? now + ms : 0;
}
export function ownedAssets(s: Pick<GameState, "assets">, playerId: string) {
  return ASSETS.filter((a) => s.assets[a.id].owner === playerId);
}
export function travelDestination(position: number | null, steps: number) {
  return ((position ?? -1) + steps) % 20;
}
export function stepsTo(position: number | null, tile: number) {
  return (tile - (position ?? -1) + 20) % 20;
}
export function createGame(
  seats: Seat[],
  seed: number,
  now = Date.now(),
  timers: Partial<Timers> = {},
): GameState {
  requireRule(
    seats.length >= 2 && seats.length <= 5,
    "Партія має містити 2–5 учасників.",
  );
  requireRule(
    new Set(seats.map((p) => p.id)).size === seats.length,
    "Учасники повинні мати різні ідентифікатори.",
  );
  requireRule(
    new Set(seats.map((p) => p.creature)).size === seats.length,
    "NUMBRA вже обрана.",
  );
  const s: GameState = {
    rulesVersion: RULES_VERSION,
    version: 1,
    rng: seed >>> 0 || 1,
    day: 1,
    maxDays: 6,
    totalTurns: 0,
    turnIndex: 0,
    phase: "turn",
    deadline: 0,
    players: seats.map((p) => ({
      ...p,
      coins: 400,
      influence: 2,
      scandals: 0,
      position: null,
      hand: [],
      goals: [],
      whisperDay: 0,
      whisperCount: 0,
      lawsPassed: 0,
      attendanceCount: 0,
      ward: false,
    })),
    assets: Object.fromEntries(
      ASSETS.map((a) => [a.id, { owner: null, level: 0, suppressedDay: 0 }]),
    ),
    deck: [],
    discard: [],
    proposals: [],
    voteIndex: 0,
    attendance: [],
    ready: [],
    laws: [],
    lawHistory: [],
    reaction: null,
    offers: [],
    log: [],
    scores: [],
    winners: [],
    eventId: "calm",
    timers: {
      turn: 30000,
      reaction: 20000,
      proposal: 30000,
      debate: 120000,
      vote: 30000,
      ...timers,
    },
  };
  s.deck = shuffle(
    s,
    CARDS.flatMap((c) => [c.id, c.id]),
  );
  const goals = shuffle(
    s,
    GOALS.map((g) => g.id),
  );
  for (const p of s.players) {
    p.goals = goals.splice(0, 2);
    for (const kind of ["action", "action", "counter", "counter"]) {
      const idx = s.deck.findIndex((id) => card(id)!.type === kind);
      if (idx >= 0) p.hand.push(s.deck.splice(idx, 1)[0]);
    }
  }
  setPhase(s, "turn", now);
  addLog(s, "Усі NUMBRA прибули до парламенту. Починається день 1.");
  return s;
}
function beginSession(s: GameState, now: number) {
  s.attendance = s.players.filter((p) => p.position === null).map((p) => p.id);
  for (const p of s.players)
    if (s.attendance.includes(p.id)) p.attendanceCount++;
  s.proposals = [];
  s.ready = [];
  s.voteIndex = 0;
  addLog(
    s,
    "Сесія " +
      s.day +
      ": у парламенті " +
      s.attendance.length +
      " із " +
      s.players.length +
      " NUMBRA.",
  );
  setPhase(s, "proposal", now);
}
function finishTurn(s: GameState, now: number) {
  s.totalTurns++;
  s.turnIndex = (s.turnIndex + 1) % s.players.length;
  s.reaction = null;
  if (s.totalTurns % 10 === 0) beginSession(s, now);
  else setPhase(s, "turn", now);
}
export function incomeFor(
  s: Pick<GameState, "assets" | "laws" | "day">,
  assetId: string,
) {
  const a = ASSETS.find((a) => a.id === assetId)!;
  const own = s.assets[assetId];
  if (own.suppressedDay === s.day) return 0;
  return (
    a.income +
    own.level * 5 +
    s.laws.filter(
      (l) =>
        l.fromDay <= s.day &&
        l.untilDay >= s.day &&
        law(l.lawId)?.group === a.group,
    ).length *
      10
  );
}
function startDay(s: GameState, now: number) {
  s.day++;
  s.laws = s.laws.filter((l) => l.untilDay >= s.day);
  s.offers = [];
  s.ready = [];
  for (const p of s.players) {
    const revenue = ownedAssets(s, p.id).reduce(
      (sum, a) => sum + incomeFor(s, a.id),
      0,
    );
    p.coins += revenue;
    for (const l of s.laws.filter((l) => l.fromDay <= s.day)) {
      if (l.lawId === "integrity")
        p.coins = Math.max(0, p.coins - p.scandals * 15);
      if (l.lawId === "solidarity" && ownedAssets(s, p.id).length <= 1)
        p.coins += 30;
    }
    influence(p, 1);
    draw(s, p, 1);
    if (revenue) addLog(s, p.name + " отримує " + revenue + " монет доходу.");
  }
  const e = EVENTS[Math.floor(random(s) * EVENTS.length)];
  s.eventId = e.id;
  for (const p of s.players) {
    if (e.effect === "festival") p.coins += 20;
    if (e.effect === "rumble") influence(p, 1);
    if (e.effect === "reconciliation") scandal(p, -1);
  }
  addLog(s, "День " + s.day + ". " + e.name + ": " + e.text);
  setPhase(s, "turn", now);
}
function finishSession(s: GameState, now: number) {
  s.offers = [];
  s.ready = [];
  if (s.day === s.maxDays) {
    s.scores = scoreGame(s);
    const best = Math.max(...s.scores.map((x) => x.total));
    const contenders = s.scores.filter((x) => x.total === best);
    const laws = Math.max(...contenders.map((x) => x.lawPoints));
    s.winners = contenders
      .filter((x) => x.lawPoints === laws)
      .map((x) => x.playerId);
    setPhase(s, "finished", now);
    addLog(s, "Шоста сесія завершена. Результати та особисті цілі розкрито.");
  } else startDay(s, now);
}
function resolveVote(s: GameState, now: number) {
  const p = s.proposals[s.voteIndex];
  const vals = Object.values(p.votes),
    yes = vals.filter((v) => v === "yes").length,
    no = vals.filter((v) => v === "no").length;
  const passed = yes > s.players.length / 2;
  s.lawHistory.push({
    lawId: p.lawId,
    author: p.author,
    yes,
    no,
    abstain: s.attendance.length - yes - no,
    absent: s.players.length - s.attendance.length,
    passed,
  });
  if (passed) {
    s.players.find((x) => x.id === p.author)!.lawsPassed++;
    s.laws = s.laws.filter((x) => x.lawId !== p.lawId);
    s.laws.push({
      lawId: p.lawId,
      author: p.author,
      fromDay: s.day + 1,
      untilDay: s.day + 2,
    });
  }
  addLog(
    s,
    law(p.lawId)!.name +
      ": " +
      yes +
      " за, " +
      no +
      " проти. " +
      (passed ? "Закон прийнято." : "Недостатньо голосів."),
  );
  s.voteIndex++;
  if (s.voteIndex < s.proposals.length) setPhase(s, "vote", now);
  else finishSession(s, now);
}
function nextParliamentPhase(s: GameState, now: number) {
  s.ready = [];
  if (s.phase === "proposal") {
    setPhase(s, "debate", now);
    addLog(
      s,
      "Час переговорів. Подано законопроєктів: " + s.proposals.length + ".",
    );
  } else if (!s.proposals.length || !s.attendance.length) finishSession(s, now);
  else {
    s.voteIndex = 0;
    setPhase(s, "vote", now);
  }
}
function applyAttack(s: GameState) {
  const r = s.reaction!;
  const target = s.players.find((p) => p.id === r.target)!;
  if (r.cardId === "rumor") scandal(target, 1);
  if (r.cardId === "investigation") {
    target.coins = Math.max(0, target.coins - 50);
    scandal(target, 1);
  }
  if (r.cardId === "pressure") influence(target, -2);
  if (
    r.cardId === "sabotage" &&
    r.assetId &&
    s.assets[r.assetId].owner === target.id
  )
    s.assets[r.assetId].suppressedDay = s.day + 1;
  addLog(
    s,
    target.name + " приймає наслідки карти «" + card(r.cardId)!.name + "».",
  );
}
function validOffer(s: GameState, o: Offer) {
  const a = s.players.find((p) => p.id === o.from),
    b = s.players.find((p) => p.id === o.to);
  requireRule(a && b && a.id !== b.id, "Вкажіть іншого учасника.");
  for (const assetId of [o.giveAsset, o.takeAsset])
    requireRule(
      assetId === undefined ||
        (typeof assetId === "string" && ASSETS.some((a) => a.id === assetId)),
      "Некоректний актив в угоді.",
    );
  requireRule(
    Number.isInteger(o.giveCoins) &&
      o.giveCoins >= 0 &&
      o.giveCoins <= 1000000 &&
      Number.isInteger(o.takeCoins) &&
      o.takeCoins >= 0 &&
      o.takeCoins <= 1000000,
    "Монети мають бути цілим невід’ємним числом.",
  );
  requireRule(
    a.coins >= o.giveCoins && b.coins >= o.takeCoins,
    "В однієї зі сторін недостатньо монет.",
  );
  if (o.giveAsset)
    requireRule(
      s.assets[o.giveAsset]?.owner === a.id,
      "Ви вже не володієте запропонованим активом.",
    );
  if (o.takeAsset)
    requireRule(
      s.assets[o.takeAsset]?.owner === b.id,
      "Суперник вже не володіє потрібним активом.",
    );
  requireRule(
    o.giveCoins + o.takeCoins > 0 || o.giveAsset || o.takeAsset,
    "Угода має містити монети або актив.",
  );
  return { a, b };
}
export function applyCommand(
  state: GameState,
  playerId: string,
  c: Command,
  now = Date.now(),
): GameState {
  requireRule(
    c && typeof c === "object" && typeof c.type === "string",
    "Невідома команда.",
  );
  requireRule(state.phase !== "finished", "Партію вже завершено.");
  const s = structuredClone(state),
    p = s.players.find((p) => p.id === playerId);
  requireRule(p, "Учасника не знайдено.");
  const turnAction = [
    "travel",
    "return",
    "pass",
    "draw",
    "upgrade",
    "card",
    "whisper",
  ].includes(c.type);
  if (turnAction) {
    requireRule(s.phase === "turn", "Зараз інша фаза партії.");
    requireRule(
      s.players[s.turnIndex].id === p.id,
      "Зараз черга іншого гравця.",
    );
  }
  if (c.type === "travel") {
    requireRule(
      Number.isInteger(c.steps) && c.steps >= 1 && c.steps <= 3,
      "За хід можна пройти 1–3 місця.",
    );
    requireRule(typeof c.buy === "boolean", "Уточніть, чи купувати актив.");
    const pos = travelDestination(p.position, c.steps),
      a = ASSETS.find((a) => a.tile === pos);
    if (c.buy) {
      requireRule(a, "У цьому місці немає активу.");
      requireRule(!s.assets[a.id].owner, "Актив вже має власника.");
      requireRule(p.coins >= a.price, "Недостатньо монет для купівлі.");
      s.assets[a.id].owner = p.id;
      p.coins -= a.price;
      addLog(s, p.name + " купує " + a.name + " за " + a.price + ".");
    } else addLog(s, p.name + " переходить на місце " + (pos + 1) + ".");
    p.position = pos;
    finishTurn(s, now);
  } else if (c.type === "return") {
    p.position = null;
    addLog(s, p.name + " повертається до парламенту.");
    finishTurn(s, now);
  } else if (c.type === "pass") {
    p.coins += 20;
    influence(p, 1);
    addLog(s, p.name + " збирає підтримку: +20 монет, +1 вплив.");
    finishTurn(s, now);
  } else if (c.type === "draw") {
    requireRule(p.hand.length < 6, "У руці вже 6 карт.");
    draw(s, p, 2);
    addLog(s, p.name + " добирає карти.");
    finishTurn(s, now);
  } else if (c.type === "upgrade") {
    const a = ASSETS.find((a) => a.tile === p.position);
    requireRule(
      a && s.assets[a.id].owner === p.id,
      "Потрібно перебувати біля власного активу.",
    );
    requireRule(
      s.assets[a.id].level < 2,
      "Актив вже має максимальне покращення.",
    );
    requireRule(p.coins >= 60, "Покращення коштує 60 монет.");
    p.coins -= 60;
    s.assets[a.id].level++;
    addLog(s, p.name + " покращує " + a.name + ".");
    finishTurn(s, now);
  } else if (c.type === "card") {
    requireRule(
      c.assetId === undefined ||
        (typeof c.assetId === "string" &&
          ASSETS.some((a) => a.id === c.assetId)),
      "Некоректний актив для карти.",
    );
    const def = card(c.cardId);
    requireRule(
      def && p.hand.includes(def.id),
      "Такої карти немає у вашій руці.",
    );
    requireRule(
      def.type === "action",
      "Контрдію можна використати лише у відповідь на атаку.",
    );
    let target: Player | undefined;
    if (def.attack) {
      target = s.players.find((x) => x.id === c.targetId);
      requireRule(target && target.id !== p.id, "Оберіть суперника.");
      if (def.id === "investigation")
        requireRule(
          ownedAssets(s, p.id).some((a) => a.group === "media"),
          "Розслідування потребує власного медіа-активу.",
        );
      if (def.id === "sabotage")
        requireRule(
          c.assetId && s.assets[c.assetId]?.owner === target.id,
          "Оберіть актив цього суперника.",
        );
    }
    if (def.id === "renovate")
      requireRule(
        c.assetId &&
          s.assets[c.assetId]?.owner === p.id &&
          s.assets[c.assetId].level < 2,
        "Оберіть власний актив з менш ніж 2 покращеннями.",
      );
    p.hand.splice(p.hand.indexOf(def.id), 1);
    s.discard.push(def.id);
    addLog(s, p.name + " грає «" + def.name + "».");
    if (def.id === "grant") p.coins += 50;
    if (def.id === "lobby") influence(p, 2);
    if (def.id === "cleanup") scandal(p, -1);
    if (def.id === "dividend") p.coins += ownedAssets(s, p.id).length * 15;
    if (def.id === "speculation")
      p.coins +=
        20 +
        ownedAssets(s, p.id).filter((a) => a.group === "trade").length * 20;
    if (def.id === "archive") draw(s, p, 2);
    if (def.id === "petition") {
      p.position = null;
      influence(p, 1);
    }
    if (def.id === "renovate") s.assets[c.assetId!].level++;
    if (def.attack) {
      if (target!.ward) {
        target!.ward = false;
        addLog(s, "Захист PACTA скасовує атаку.");
        finishTurn(s, now);
      } else {
        s.reaction = {
          source: p.id,
          target: target!.id,
          cardId: def.id,
          assetId: c.assetId,
        };
        setPhase(s, "reaction", now);
      }
    } else finishTurn(s, now);
  } else if (c.type === "react") {
    requireRule(
      s.phase === "reaction" && s.reaction?.target === p.id,
      "Лише адресат атаки може відповісти.",
    );
    if (c.cardId) {
      const def = card(c.cardId);
      requireRule(
        def?.type === "counter" && p.hand.includes(def.id),
        "Оберіть контрдію зі своєї руки.",
      );
      requireRule(
        def.counters?.includes("all") ||
          def.counters?.includes(s.reaction.cardId),
        "Ця контрдія не скасовує таку атаку.",
      );
      if (def.id === "veil") {
        requireRule(p.influence >= 1, "Для завіси потрібен 1 вплив.");
        influence(p, -1);
      }
      p.hand.splice(p.hand.indexOf(def.id), 1);
      s.discard.push(def.id);
      if (def.id === "rebuttal")
        scandal(
          s.players.find((x) => x.id === s.reaction!.source)!,
          1,
        );
      if (def.id === "mediation") p.coins += 20;
      addLog(s, p.name + " скасовує атаку картою «" + def.name + "».");
    } else applyAttack(s);
    finishTurn(s, now);
  } else if (c.type === "whisper") {
    requireRule(p.influence >= 2, "Whisper потребує 2 впливу.");
    requireRule(p.whisperDay !== s.day, "Whisper вже використано сьогодні.");
    const target = s.players.find((x) => x.id === c.targetId);
    if (p.creature === "MANIPUL")
      requireRule(target && target.id !== p.id, "Оберіть суперника.");
    if (p.creature === "OBFUSCO")
      requireRule(
        Number.isInteger(c.position) && c.position! >= 0 && c.position! < 20,
        "Оберіть місце маршруту.",
      );
    influence(p, -2);
    p.whisperDay = s.day;
    p.whisperCount++;
    if (p.creature === "MANIPUL") {
      influence(target!, -2);
      influence(p, 1);
    }
    if (p.creature === "TRADOR") p.coins += 60;
    if (p.creature === "PACTA") p.ward = true;
    if (p.creature === "RHETOR") {
      draw(s, p, 2);
      influence(p, 1);
    }
    if (p.creature === "OBFUSCO") {
      p.position = c.position!;
      draw(s, p, 1);
    }
    addLog(s, p.name + " пробуджує Whisper " + p.creature + ".");
    finishTurn(s, now);
  } else if (c.type === "propose") {
    requireRule(s.phase === "proposal", "Час подання законів завершено.");
    requireRule(
      s.attendance.includes(p.id),
      "Ваша NUMBRA відсутня у парламенті.",
    );
    requireRule(!s.ready.includes(p.id), "Ви вже завершили подання законів.");
    requireRule(law(c.lawId), "Невідомий закон.");
    requireRule(s.proposals.length < 2, "У сесії вже 2 законопроєкти.");
    requireRule(
      !s.proposals.some((x) => x.lawId === c.lawId),
      "Цей закон уже подано.",
    );
    requireRule(p.influence >= 1, "Подання закону потребує 1 впливу.");
    influence(p, -1);
    s.proposals.push({
      id: "day" + s.day + "-" + c.lawId,
      lawId: c.lawId,
      author: p.id,
      votes: {},
    });
    addLog(s, p.name + " подає закон «" + law(c.lawId)!.name + "».");
  } else if (c.type === "ready") {
    requireRule(
      s.phase === "proposal" || s.phase === "debate",
      "Зараз не час завершувати переговори.",
    );
    requireRule(!s.ready.includes(p.id), "Готовність уже підтверджена.");
    s.ready.push(p.id);
    if (s.ready.length === s.players.length) nextParliamentPhase(s, now);
  } else if (c.type === "vote") {
    requireRule(s.phase === "vote", "Зараз немає голосування.");
    requireRule(
      s.attendance.includes(p.id),
      "Ваша NUMBRA відсутня у парламенті.",
    );
    requireRule(["yes", "no", "abstain"].includes(c.vote), "Невідомий голос.");
    const prop = s.proposals[s.voteIndex];
    requireRule(!(p.id in prop.votes), "Ви вже проголосували.");
    prop.votes[p.id] = c.vote;
    if (Object.keys(prop.votes).length === s.attendance.length)
      resolveVote(s, now);
  } else if (c.type === "offer") {
    requireRule(s.phase !== "reaction", "Дочекайтесь завершення контрдії.");
    requireRule(
      typeof c.offerId === "string" &&
        c.offerId.length > 0 &&
        c.offerId.length <= 80,
      "Некоректний номер угоди.",
    );
    requireRule(
      !s.offers.some((o) => o.id === c.offerId),
      "Така угода вже існує.",
    );
    requireRule(
      s.offers.filter((o) => o.from === p.id).length < 3,
      "Одночасно можна мати 3 пропозиції.",
    );
    const offer: Offer = {
      id: c.offerId,
      from: p.id,
      to: c.to,
      giveCoins: c.giveCoins,
      takeCoins: c.takeCoins,
      giveAsset: c.giveAsset,
      takeAsset: c.takeAsset,
    };
    validOffer(s, offer);
    s.offers.push(offer);
  } else if (c.type === "acceptOffer") {
    const o = s.offers.find((o) => o.id === c.offerId);
    requireRule(o && o.to === p.id, "Лише адресат може прийняти цю угоду.");
    const { a, b } = validOffer(s, o);
    a.coins = a.coins - o.giveCoins + o.takeCoins;
    b.coins = b.coins - o.takeCoins + o.giveCoins;
    if (o.giveAsset) s.assets[o.giveAsset].owner = b.id;
    if (o.takeAsset) s.assets[o.takeAsset].owner = a.id;
    s.offers = s.offers.filter((x) => x.id !== o.id);
    addLog(s, a.name + " і " + b.name + " виконали угоду.");
  } else if (c.type === "cancelOffer") {
    const o = s.offers.find((o) => o.id === c.offerId);
    requireRule(o && (o.from === p.id || o.to === p.id), "Угоду не знайдено.");
    s.offers = s.offers.filter((x) => x.id !== o.id);
  } else throw new RuleError("Невідома команда.");
  s.version++;
  return s;
}
export function tick(state: GameState, now = Date.now()): GameState {
  if (state.phase === "finished" || !state.deadline || now < state.deadline)
    return state;
  if (state.phase === "turn")
    return applyCommand(
      state,
      state.players[state.turnIndex].id,
      { type: "pass" },
      now,
    );
  if (state.phase === "reaction")
    return applyCommand(state, state.reaction!.target, { type: "react" }, now);
  const s = structuredClone(state);
  if (s.phase === "proposal" || s.phase === "debate")
    nextParliamentPhase(s, now);
  else if (s.phase === "vote") {
    const prop = s.proposals[s.voteIndex];
    for (const id of s.attendance)
      if (!(id in prop.votes)) prop.votes[id] = "abstain";
    resolveVote(s, now);
  }
  s.version++;
  return s;
}
function goalComplete(s: GameState, p: Player, id: string) {
  const owned = ownedAssets(s, p.id);
  if (id === "estate") return owned.length >= 3;
  if (["trade", "industry", "media", "logistics"].includes(id))
    return owned.filter((a) => a.group === id).length >= 2;
  if (id === "laws") return p.lawsPassed >= 2;
  if (id === "rich") return p.coins >= 700;
  if (id === "clean") return p.scandals === 0 && p.lawsPassed >= 1;
  if (id === "attendance") return p.attendanceCount >= 4;
  if (id === "whisper") return p.whisperCount >= 3;
  return false;
}
export function scoreGame(s: GameState): Score[] {
  return s.players
    .map((p) => {
      const assetPoints = ownedAssets(s, p.id).reduce(
        (sum, a) => sum + a.points + s.assets[a.id].level,
        0,
      );
      const coinPoints = Math.floor(p.coins / 200),
        lawPoints = p.lawsPassed * 2,
        goals = p.goals.map((id) => ({
          id,
          completed: goalComplete(s, p, id),
        }));
      const goalPoints = goals.filter((g) => g.completed).length * 3;
      return {
        playerId: p.id,
        total: assetPoints + coinPoints + lawPoints + goalPoints - p.scandals,
        assetPoints,
        coinPoints,
        lawPoints,
        goalPoints,
        scandalPenalty: p.scandals,
        goals,
      };
    })
    .sort((a, b) => b.total - a.total || b.lawPoints - a.lawPoints);
}
export function viewFor(s: GameState, playerId: string): GameView {
  const me = s.players.find((p) => p.id === playerId);
  requireRule(me, "Учасника не знайдено.");
  // Explicit allow-list: never spread a full player or game state here.
  return structuredClone({
    rulesVersion: s.rulesVersion,
    version: s.version,
    day: s.day,
    maxDays: s.maxDays,
    totalTurns: s.totalTurns,
    turnIndex: s.turnIndex,
    phase: s.phase,
    deadline: s.deadline,
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      creature: p.creature,
      bot: p.bot,
      coins: p.coins,
      influence: p.influence,
      scandals: p.scandals,
      position: p.position,
      handCount: p.hand.length,
      lawsPassed: p.lawsPassed,
      attendanceCount: p.attendanceCount,
      ward: p.ward,
      whisperDay: p.whisperDay,
      whisperCount: p.whisperCount,
    })),
    assets: s.assets,
    proposals: s.proposals.map((p) => ({
      id: p.id,
      lawId: p.lawId,
      author: p.author,
      votesCast: Object.keys(p.votes).length,
      ownVote: p.votes[playerId],
    })),
    voteIndex: s.voteIndex,
    attendance: s.attendance,
    ready: s.ready,
    laws: s.laws,
    lawHistory: s.lawHistory,
    reaction: s.reaction,
    offers: s.offers.filter((o) => o.from === playerId || o.to === playerId),
    log: s.log,
    scores: s.phase === "finished" ? s.scores : [],
    winners: s.winners,
    eventId: s.eventId,
    self: { id: me.id, hand: me.hand, goals: me.goals },
  });
}
