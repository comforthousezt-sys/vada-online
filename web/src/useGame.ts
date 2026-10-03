import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyCommand,
  createGame,
  tick,
  viewFor,
} from "../../shared/engine.js";
import { chooseBotCommand } from "../../shared/bot.js";
import { CREATURES, RULES_VERSION } from "../../shared/content.js";
import type {
  Command,
  CreatureId,
  GameState,
  GameView,
} from "../../shared/types.js";
import type { RoomCommand, RoomView } from "../../server/rooms.js";
declare global {
  interface Window {
    VADA_CONFIG?: { apiBase?: string };
  }
}
type Credentials = { code: string; token: string; playerId: string };
const SAVE = "vada.practice.v02",
  SESSION = "vada.session.v02";
function read<T>(storage: Storage, key: string): T | null {
  try {
    return JSON.parse(storage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function write(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* unavailable storage keeps the current match playable */
  }
}
function getSaved(): GameState | null {
  const s = read<GameState>(localStorage, SAVE);
  if (
    s?.rulesVersion === RULES_VERSION &&
    Array.isArray(s.players) &&
    s.players.some((p) => p.id === "self") &&
    s.assets &&
    Array.isArray(s.log) &&
    s.timers
  )
    return s;
  return null;
}
export function getApiBase() {
  const raw = window.VADA_CONFIG?.apiBase?.trim().replace(/\/+$/, "") ?? "";
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.origin
      : "";
  } catch {
    return "";
  }
}
export function useGame() {
  const [local, setLocal] = useState<GameState | null>(null),
    localRef = useRef<GameState | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null),
    roomRef = useRef<RoomView | null>(null);
  const [mode, setMode] = useState<"local" | "online" | null>(null);
  const [session, setSession] = useState<Credentials | null>(null);
  const [status, setStatus] = useState<
    "offline" | "connecting" | "online" | "reconnecting"
  >("offline");
  const [busy, setBusy] = useState(false),
    [networkBusy, setNetworkBusy] = useState(false);
  const [error, setError] = useState(""),
    [clockOffset, setClockOffset] = useState(0);
  const [hasSave, setHasSave] = useState(() => !!getSaved());
  const [hasSession, setHasSession] = useState(
    () => !!read<Credentials>(sessionStorage, SESSION),
  );
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef<{
    type: "command";
    id: string;
    version: number;
    command: RoomCommand;
  } | null>(null);
  const ackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sendPending = useCallback((ws: WebSocket) => {
    if (!pending.current || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(pending.current));
    clearTimeout(ackTimer.current);
    ackTimer.current = setTimeout(() => {
      setStatus("reconnecting");
      ws.close();
    }, 12000);
  }, []);
  const chatWait = useRef(
    new Map<string, { resolve: () => void; reject: (e: Error) => void }>(),
  );
  const updateLocal = useCallback((s: GameState) => {
    localRef.current = s;
    setLocal(s);
    write(localStorage, SAVE, s);
    setHasSave(true);
  }, []);
  const updateRoom = useCallback((r: RoomView) => {
    roomRef.current = r;
    setRoom(r);
  }, []);
  const startPractice = useCallback(
    (selected: CreatureId, count = 4) => {
      const creatures = CREATURES.filter((c) => c.id !== selected).slice(
        0,
        count - 1,
      );
      const s = createGame(
        [
          { id: "self", name: "Ви", creature: selected, bot: false },
          ...creatures.map((c, i) => ({
            id: "bot" + i,
            name: c.id,
            creature: c.id,
            bot: true,
          })),
        ],
        crypto.getRandomValues(new Uint32Array(1))[0],
        Date.now(),
        { turn: 0, reaction: 0, proposal: 0, debate: 0, vote: 0 },
      );
      setSession(null);
      setRoom(null);
      roomRef.current = null;
      setMode("local");
      setError("");
      updateLocal(s);
    },
    [updateLocal],
  );
  const continuePractice = useCallback(() => {
    const s = getSaved();
    if (s) {
      setMode("local");
      setSession(null);
      setError("");
      updateLocal(s);
    } else {
      setHasSave(false);
      setError("Збереження цієї редакції не знайдено. Почніть нову партію.");
    }
  }, [updateLocal]);
  const connect = useCallback(
    (credentials: Credentials, r?: RoomView) => {
      write(sessionStorage, SESSION, credentials);
      setHasSession(true);
      setMode("online");
      setLocal(null);
      localRef.current = null;
      setSession(credentials);
      if (r) updateRoom(r);
      setError("");
    },
    [updateRoom],
  );
  const resumeOnline = useCallback(() => {
    const saved = read<Credentials>(sessionStorage, SESSION);
    if (saved && getApiBase()) connect(saved);
    else setError("Місце цієї кімнати не знайдено в поточній вкладці.");
  }, [connect]);
  const createOrJoin = useCallback(
    async (name: string, creature: CreatureId, code?: string) => {
      const api = getApiBase();
      if (!api) {
        setError(
          "Онлайн-сервер ще не підключено. Наразі доступна гра з ботами.",
        );
        return false;
      }
      setNetworkBusy(true);
      setError("");
      const ac = new AbortController(),
        timeout = setTimeout(() => ac.abort(), 75000);
      try {
        const response = await fetch(
          api +
            (code
              ? "/api/rooms/" + code.toUpperCase().trim() + "/join"
              : "/api/rooms"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, creature }),
            signal: ac.signal,
          },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Не вдалося відкрити кімнату.");
        connect(
          { code: data.view.code, token: data.token, playerId: data.playerId },
          data.view,
        );
        return true;
      } catch (e) {
        setError(
          e instanceof Error && e.name !== "AbortError"
            ? e.message
            : "Сервер не відповів. Зачекайте хвилину й повторіть.",
        );
        return false;
      } finally {
        clearTimeout(timeout);
        setNetworkBusy(false);
      }
    },
    [connect],
  );
  useEffect(() => {
    if (!session || mode !== "online") return;
    let disposed = false,
      fatal = false,
      attempt = 0,
      retry: ReturnType<typeof setTimeout> | undefined;
    function open() {
      if (disposed) return;
      setStatus(attempt ? "reconnecting" : "connecting");
      const ws = new WebSocket(getApiBase().replace(/^http/, "ws") + "/ws");
      socket.current = ws;
      let authenticated = false;
      ws.onopen = () =>
        ws.send(
          JSON.stringify({
            type: "authenticate",
            code: session!.code,
            token: session!.token,
          }),
        );
      ws.onmessage = (event) => {
        if (disposed) return;
        let m: any;
        try {
          m = JSON.parse(event.data);
        } catch {
          setError("Сервер надіслав некоректну відповідь.");
          return;
        }
        if (typeof m.serverTime === "number")
          setClockOffset(m.serverTime - Date.now());
        if (m.view) {
          updateRoom(m.view);
          setStatus("online");
          attempt = 0;
        }
        if (m.type === "view" && !authenticated) {
          authenticated = true;
          sendPending(ws);
        }
        if (m.type === "ack" && pending.current?.id === m.id) {
          pending.current = null;
          setBusy(false);
          clearTimeout(ackTimer.current);
        }
        if (m.type === "chatAck") {
          chatWait.current.get(m.id)?.resolve();
          chatWait.current.delete(m.id);
        }
        if (m.type === "error") {
          setError(m.error ?? "Дію не підтверджено.");
          if (pending.current?.id === m.id) {
            pending.current = null;
            setBusy(false);
            clearTimeout(ackTimer.current);
          }
          const waiter = chatWait.current.get(m.id);
          if (waiter) {
            waiter.reject(new Error(m.error));
            chatWait.current.delete(m.id);
          }
          if (m.fatal || (!m.view && !m.id)) {
            fatal = true;
            setStatus("offline");
            pending.current = null;
            setBusy(false);
            setHasSession(false);
            try {
              sessionStorage.removeItem(SESSION);
            } catch {}
            setRoom(null);
            roomRef.current = null;
            setSession(null);
            ws.close();
          }
        }
      };
      ws.onerror = () => {
        if (!disposed) setStatus("reconnecting");
      };
      ws.onclose = () => {
        clearTimeout(ackTimer.current);
        for (const waiter of chatWait.current.values())
          waiter.reject(
            new Error(
              "Зв’язок перервався. Повідомлення можна надіслати повторно.",
            ),
          );
        chatWait.current.clear();
        if (!disposed && !fatal) {
          attempt++;
          setStatus("reconnecting");
          retry = setTimeout(open, Math.min(8000, 1000 * attempt));
        }
      };
    }
    open();
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearTimeout(ackTimer.current);
      socket.current?.close();
      socket.current = null;
      pending.current = null;
      setBusy(false);
      setStatus("offline");
    };
  }, [session, mode, updateRoom, sendPending]);
  useEffect(() => {
    if (mode !== "local") return;
    const timer = setInterval(() => {
      const old = localRef.current;
      if (!old || old.phase === "finished") return;
      let s = tick(old, Date.now());
      if (s === old)
        for (const p of old.players.filter((p) => p.bot)) {
          const command = chooseBotCommand(viewFor(s, p.id));
          if (command) {
            s = applyCommand(s, p.id, command);
            break;
          }
        }
      if (s !== old) updateLocal(s);
    }, 650);
    return () => clearInterval(timer);
  }, [mode, updateLocal]);
  const send = useCallback(
    (command: RoomCommand) => {
      setError("");
      if (mode === "local") {
        try {
          const s = localRef.current;
          if (s) updateLocal(applyCommand(s, "self", command as Command));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Дію не підтверджено.");
        }
      } else if (mode === "online") {
        if (pending.current) return;
        if (
          socket.current?.readyState !== WebSocket.OPEN ||
          status !== "online" ||
          !roomRef.current
        ) {
          setError("Зв’язок відновлюється. Дочекайтесь підтвердження.");
          return;
        }
        pending.current = {
          type: "command",
          id: crypto.randomUUID(),
          version: roomRef.current.version,
          command,
        };
        setBusy(true);
        sendPending(socket.current);
      }
    },
    [mode, status, updateLocal, sendPending],
  );
  const sendChat = useCallback(
    (text: string) =>
      new Promise<void>((resolve, reject) => {
        if (
          mode !== "online" ||
          socket.current?.readyState !== WebSocket.OPEN ||
          status !== "online"
        ) {
          reject(new Error("Чат доступний у підключеній онлайн-кімнаті."));
          return;
        }
        const id = crypto.randomUUID();
        chatWait.current.set(id, { resolve, reject });
        socket.current.send(JSON.stringify({ type: "chat", id, text }));
        setTimeout(() => {
          const waiter = chatWait.current.get(id);
          if (waiter) {
            waiter.reject(
              new Error("Повідомлення не підтверджене. Повторіть надсилання."),
            );
            chatWait.current.delete(id);
          }
        }, 12000);
      }),
    [mode, status],
  );
  const view: GameView | null =
    mode === "local" && local ? viewFor(local, "self") : (room?.game ?? null);
  return {
    view,
    room,
    mode,
    status,
    busy: busy || networkBusy,
    networkBusy,
    error,
    setError,
    clockOffset,
    hasSave,
    hasSession,
    startPractice,
    continuePractice,
    createOrJoin,
    resumeOnline,
    send,
    sendChat,
  };
}
