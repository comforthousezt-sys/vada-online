import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("startup logs identify an invalid database URL without exposing credentials", () => {
  const password = "startup-credential-canary";
  const databaseUrl = `postgresql://postgres:${password}@[`;
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      fileURLToPath(new URL("../server/index.ts", import.meta.url)),
    ],
    {
      env: {
        ...process.env,
        RENDER: "true",
        ALLOWED_ORIGINS: "https://vadagames.com",
        DATABASE_URL: databaseUrl,
        ALLOW_EPHEMERAL: "false",
      },
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  const logs = result.stdout + result.stderr;
  assert.match(logs, /ERR_INVALID_URL/);
  assert(!logs.includes(password));
  assert(!logs.includes(databaseUrl));
});
