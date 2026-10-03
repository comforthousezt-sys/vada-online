import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { CREATURES } from "../shared/content.js";
import {
  applyCommand,
  createGame,
  RuleError,
  tick,
  viewFor,
} from "../shared/engine.js";
import { chooseBotCommand } from "../shared/bot.js";
import type {
  Command,
  CreatureId,
  GameState,
  GameView,
  Seat,
  Timers,
} from "../shared/types.js";
export type RoomCommand =
  Command | { type: "start" | "addBot" | "removeBot"; playerId?: string };
export interface StoredRoom {
  code: string;
  hostId: string;
  version: number;
  revision: number;
  seats: Seat[];
  game: GameState | null;
  credentials: { playerId: string; hash: string }[];
  accepted: {
    id: string;
    playerId: string;
    fingerprint: string;
    version: number;
  }[];
  chat: { id: string; playerId: string; text: string; at: number }[];
  updatedAt: number;
  createdAt: number;
}
export interface RoomView {
  code: string;
  hostId: string;
  version: number;
  selfId: string;
  seats: Seat[];
  game: GameView | null;
  chat: StoredRoom["chat"];
  persistence: string;
}
export interface RoomStore {
  kind: string;
  load(): Promise<StoredRoom[]>;
  get(code: string): Promise<StoredRoom | null>;
  save(room: StoredRoom): Promise<void>;
  remove(code: string): Promise<void>;
  close(): Promise<void>;
}
export class StorageConflict extends RuleError {
  constructor() {
    super(
      "Стан змінився під час збереження. Перевірте оновлену партію й повторіть дію.",
    );
  }
}
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export class RoomManager {
  readonly rooms = new Map<string, StoredRoom>();
  private queues = new Map<string, Promise<unknown>>();
  onChange: (code: string) => void = () => {};
  constructor(
    readonly store: RoomStore,
    readonly timers: Partial<Timers> = {},
  ) {}
  async initialize() {
    for (const r of await this.store.load())
      if (Date.now() - r.updatedAt < 86400000) this.rooms.set(r.code, r);
      else await this.store.remove(r.code);
  }
  private async serial<T>(code: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(code) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(fn);
    this.queues.set(code, next);
    try {
      return await next;
    } finally {
      if (this.queues.get(code) === next) this.queues.delete(code);
    }
  }
  private room(code: string) {
    const r = this.rooms.get(code);
    if (!r)
      throw new RuleError(
        "Кімнату не знайдено. Перевірте код або створіть нову.",
      );
    return r;
  }
  private name(name: unknown) {
    if (typeof name !== "string") throw new RuleError("Вкажіть ім’я.");
    const clean = name.trim().replace(/[\u0000-\u001f\u007f]/g, "");
    if (clean.length < 2 || clean.length > 30)
      throw new RuleError("Ім’я має містити 2–30 символів.");
    return clean;
  }
  private selected(id: unknown, room?: StoredRoom): CreatureId {
    if (!CREATURES.some((c) => c.id === id))
      throw new RuleError("Оберіть NUMBRA зі списку.");
    if (room?.seats.some((p) => p.creature === id))
      throw new RuleError("Цю NUMBRA уже обрали. Оберіть іншу.");
    return id as CreatureId;
  }
  async refresh(code: string) {
    const stored = await this.store.get(code),
      old = this.rooms.get(code);
    if (stored && (!old || stored.revision > old.revision)) {
      this.rooms.set(code, stored);
      this.onChange(code);
    }
  }
  private async commit(r: StoredRoom) {
    r.revision = (this.rooms.get(r.code)?.revision ?? 0) + 1;
    try {
      await this.store.save(r);
    } catch (e) {
      if (e instanceof StorageConflict) await this.refresh(r.code);
      throw e;
    }
    this.rooms.set(r.code, r);
    this.onChange(r.code);
  }
  async create(name: unknown, selected: unknown) {
    if (this.rooms.size >= 100)
      throw new RuleError("Усі місця для кімнат зайняті. Спробуйте пізніше.");
    const player: Seat = {
      id: randomUUID(),
      name: this.name(name),
      creature: this.selected(selected),
      bot: false,
    };
    let code: string;
    do {
      code = randomBytes(5).toString("hex").slice(0, 6).toUpperCase();
    } while (this.rooms.has(code));
    const token = randomBytes(32).toString("base64url"),
      now = Date.now();
    const r: StoredRoom = {
      code,
      hostId: player.id,
      version: 1,
      revision: 0,
      seats: [player],
      game: null,
      credentials: [{ playerId: player.id, hash: hashToken(token) }],
      accepted: [],
      chat: [],
      updatedAt: now,
      createdAt: now,
    };
    await this.commit(r);
    return { token, playerId: player.id, view: this.view(code, player.id) };
  }
  async join(code: string, name: unknown, selected: unknown) {
    return this.serial(code, async () => {
      await this.refresh(code);
      const old = this.room(code);
      if (old.game)
        throw new RuleError(
          "Партія вже почалася. До неї можна повернутися лише зі збереженого місця.",
        );
      if (old.seats.length >= 5)
        throw new RuleError("У кімнаті вже 5 гравців.");
      const r = structuredClone(old),
        player: Seat = {
          id: randomUUID(),
          name: this.name(name),
          creature: this.selected(selected, r),
          bot: false,
        };
      const token = randomBytes(32).toString("base64url");
      r.seats.push(player);
      r.credentials.push({ playerId: player.id, hash: hashToken(token) });
      r.version++;
      r.updatedAt = Date.now();
      await this.commit(r);
      return { token, playerId: player.id, view: this.view(code, player.id) };
    });
  }
  authenticate(code: string, token: unknown) {
    if (typeof token !== "string" || token.length !== 43)
      throw new RuleError(
        "Місце гравця не підтверджено. Відкрийте кімнату у початковій вкладці.",
      );
    const r = this.room(code),
      hash = Buffer.from(hashToken(token), "hex");
    const credential = r.credentials.find((c) =>
      timingSafeEqual(Buffer.from(c.hash, "hex"), hash),
    );
    if (!credential) throw new RuleError("Місце гравця не підтверджено.");
    return credential.playerId;
  }
  view(code: string, playerId: string): RoomView {
    const r = this.room(code);
    if (!r.seats.some((p) => p.id === playerId))
      throw new RuleError("Учасника не знайдено.");
    return structuredClone({
      code: r.code,
      hostId: r.hostId,
      version: r.version,
      selfId: playerId,
      seats: r.seats,
      game: r.game ? viewFor(r.game, playerId) : null,
      chat: r.chat,
      persistence: this.store.kind,
    });
  }
  async execute(
    code: string,
    playerId: string,
    id: unknown,
    version: unknown,
    c: RoomCommand,
    now = Date.now(),
  ) {
    return this.serial(code, async () => {
      await this.refresh(code);
      const old = this.room(code);
      if (!old.seats.some((p) => p.id === playerId && !p.bot))
        throw new RuleError("Учасника не знайдено.");
      if (typeof id !== "string" || !id.length || id.length > 80)
        throw new RuleError("Некоректний номер операції.");
      if (!Number.isInteger(version) || Number(version) < 1)
        throw new RuleError("Некоректна версія партії.");
      const fingerprint = hashToken(JSON.stringify({ version, command: c }));
      const saved = old.accepted.find(
        (op) => op.id === id && op.playerId === playerId,
      );
      if (saved) {
        if (saved.fingerprint !== fingerprint)
          throw new RuleError("Номер операції вже використано для іншої дії.");
        return {
          duplicate: true,
          appliedVersion: saved.version,
          view: this.view(code, playerId),
        };
      }
      if (old.version !== version)
        throw new RuleError(
          "Стан змінився. Перевірте оновлену карту й повторіть дію.",
        );
      if (old.accepted.length >= 5000)
        throw new RuleError("Ліміт дій цієї кімнати вичерпано.");
      const r = structuredClone(old);
      if (!r.game) {
        if (playerId !== r.hostId)
          throw new RuleError("Лише власник кімнати керує підготовкою.");
        if (c.type === "addBot") {
          if (r.seats.length >= 5)
            throw new RuleError("У кімнаті вже 5 учасників.");
          const creature = CREATURES.find(
            (x) => !r.seats.some((p) => p.creature === x.id),
          )!;
          r.seats.push({
            id: randomUUID(),
            name: creature.id + " · бот",
            creature: creature.id,
            bot: true,
          });
        } else if (c.type === "removeBot") {
          if (!r.seats.some((p) => p.id === c.playerId && p.bot))
            throw new RuleError("Цього бота немає у кімнаті.");
          r.seats = r.seats.filter((p) => p.id !== c.playerId);
        } else if (c.type === "start") {
          if (r.seats.length < 3)
            throw new RuleError(
              "Додайте учасників або ботів: потрібно щонайменше 3.",
            );
          r.game = createGame(
            r.seats,
            randomBytes(4).readUInt32LE(),
            now,
            this.timers,
          );
        } else throw new RuleError("Спочатку почніть партію.");
      } else r.game = applyCommand(r.game, playerId, c as Command, now);
      r.version++;
      r.updatedAt = now;
      r.accepted.push({ id, playerId, fingerprint, version: r.version });
      await this.commit(r);
      return {
        duplicate: false,
        appliedVersion: r.version,
        view: this.view(code, playerId),
      };
    });
  }
  async chat(code: string, playerId: string, id: unknown, text: unknown) {
    return this.serial(code, async () => {
      const old = this.room(code);
      if (!old.seats.some((p) => p.id === playerId && !p.bot))
        throw new RuleError("Учасника не знайдено.");
      if (
        typeof text !== "string" ||
        text.trim().length < 1 ||
        text.length > 500
      )
        throw new RuleError("Повідомлення має містити 1–500 символів.");
      if (typeof id !== "string" || id.length > 80)
        throw new RuleError("Некоректне повідомлення.");
      if (old.chat.some((x) => x.id === id && x.playerId === playerId)) return;
      const r = structuredClone(old);
      r.chat.push({ id, playerId, text: text.trim(), at: Date.now() });
      r.chat = r.chat.slice(-100);
      r.updatedAt = Date.now();
      await this.commit(r);
    });
  }
  async pump(now = Date.now()) {
    await Promise.allSettled(
      [...this.rooms.keys()].map((code) =>
        this.serial(code, async () => {
          const old = this.room(code);
          if (now - old.updatedAt > 86400000) {
            await this.store.remove(code);
            this.rooms.delete(code);
            return;
          }
          if (!old.game || old.game.phase === "finished") return;
          let game = tick(old.game, now);
          if (game === old.game) {
            for (const p of old.seats.filter((p) => p.bot)) {
              const command = chooseBotCommand(viewFor(game, p.id));
              if (command) {
                game = applyCommand(game, p.id, command, now);
                break;
              }
            }
          }
          if (game !== old.game) {
            const r = structuredClone(old);
            r.game = game;
            r.version++;
            r.updatedAt = now;
            await this.commit(r);
          }
        }),
      ),
    );
  }
  async drain() {
    await Promise.allSettled([...this.queues.values()]);
  }
}
