import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  rename,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { StorageConflict, type RoomStore, type StoredRoom } from "./rooms.js";
export class FileStore implements RoomStore {
  kind = "local-files";
  constructor(readonly directory: string) {}
  async load() {
    await mkdir(this.directory, { recursive: true });
    const files = (await readdir(this.directory)).filter((f) =>
      /^[A-F0-9]{6}\.json$/.test(f),
    );
    return Promise.all(
      files.map(
        async (f) =>
          JSON.parse(
            await readFile(join(this.directory, f), "utf8"),
          ) as StoredRoom,
      ),
    );
  }
  async get(code: string) {
    try {
      return JSON.parse(
        await readFile(join(this.directory, code + ".json"), "utf8"),
      ) as StoredRoom;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async save(room: StoredRoom) {
    const path = join(this.directory, room.code + ".json"),
      tmp = path + ".tmp";
    await mkdir(this.directory, { recursive: true });
    await writeFile(tmp, JSON.stringify(room), { mode: 0o600 });
    await rename(tmp, path);
  }
  async remove(code: string) {
    await unlink(join(this.directory, code + ".json")).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
  async close() {}
}
export class MemoryStore implements RoomStore {
  kind = "ephemeral-demo";
  data = new Map<string, StoredRoom>();
  failNext = false;
  async load() {
    return structuredClone([...this.data.values()]);
  }
  async get(code: string) {
    return structuredClone(this.data.get(code) ?? null);
  }
  async save(room: StoredRoom) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("storage unavailable");
    }
    if ((this.data.get(room.code)?.revision ?? 0) !== room.revision - 1)
      throw new StorageConflict();
    this.data.set(room.code, structuredClone(room));
  }
  async remove(code: string) {
    this.data.delete(code);
  }
  async close() {}
}
export class PostgresStore implements RoomStore {
  kind = "postgres";
  private pool: pg.Pool;
  constructor(url: string, caBase64 = "") {
    // A Supabase pooler connection is accepted. Strip URL SSL options so pg cannot
    // silently replace the explicit certificate-verification configuration.
    const parsed = new URL(url),
      local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
        parsed.hostname,
      );
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
      parsed.searchParams.delete(key);
    const ssl = local
      ? false
      : {
          rejectUnauthorized: true,
          ...(caBase64
            ? { ca: Buffer.from(caBase64, "base64").toString("utf8") }
            : {}),
        };
    this.pool = new pg.Pool({
      connectionString: parsed.toString(),
      ssl,
      max: 4,
      connectionTimeoutMillis: 10000,
      query_timeout: 10000,
    });
    this.pool.on("error", () => {}); // Requests still reject on database errors; never log credentials.
  }
  async load() {
    const r = await this.pool.query("select snapshot from vada_private.rooms");
    return r.rows.map((x) => x.snapshot as StoredRoom);
  }
  async get(code: string) {
    const r = await this.pool.query(
      "select snapshot from vada_private.rooms where code=$1",
      [code],
    );
    return (r.rows[0]?.snapshot as StoredRoom) ?? null;
  }
  async save(room: StoredRoom) {
    const r = await this.pool.query(
      room.revision === 1
        ? "insert into vada_private.rooms(code,snapshot,revision,updated_at) values($1,$2,$3,now()) on conflict(code) do nothing returning code"
        : "update vada_private.rooms set snapshot=$2,revision=$3,updated_at=now() where code=$1 and revision=$3-1 returning code",
      [room.code, JSON.stringify(room), room.revision],
    );
    if (r.rowCount !== 1) throw new StorageConflict();
  }
  async remove(code: string) {
    await this.pool.query("delete from vada_private.rooms where code=$1", [
      code,
    ]);
  }
  async close() {
    await this.pool.end();
  }
}
