import { createServer } from "node:http";
import { once } from "node:events";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium, expect as baseExpect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createRoomServer } from "../server/index.js";
import { MemoryStore } from "../server/store.js";
import { createGame } from "../shared/engine.js";
import { CREATURES } from "../shared/content.js";

// Exercise the production build from a subdirectory, exactly as on shared hosting.
const expect = baseExpect.configure({ timeout: 15000 });
const root = resolve("dist"),
  artifacts = resolve("docs/screenshots");
await mkdir(artifacts, { recursive: true });
let apiBase = "";
const web = createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path === "/vada/config.js") {
    res.setHeader("Content-Type", "application/javascript");
    res.end("window.VADA_CONFIG=" + JSON.stringify({ apiBase }) + ";");
    return;
  }
  const relative = path.replace(/^\/vada\//, "") || "index.html",
    file = resolve(root, relative);
  if (!path.startsWith("/vada/") || !file.startsWith(root + "/")) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const bytes = await readFile(file);
    const mime: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
    };
    res.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
web.listen(0, "127.0.0.1");
await once(web, "listening");
const origin = "http://127.0.0.1:" + (web.address() as { port: number }).port,
  url = origin + "/vada/";
const api = await createRoomServer(new MemoryStore(), [origin], {
  turn: 120000,
  proposal: 120000,
  debate: 120000,
  vote: 120000,
});
api.server.listen(0, "127.0.0.1");
await once(api.server, "listening");
apiBase = "http://127.0.0.1:" + (api.server.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  args: [
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--no-zygote",
    "--use-gl=angle",
    "--use-angle=swiftshader",
  ],
  headless: true,
});
const errors: string[] = [],
  checks: string[] = [],
  accessibility: unknown[] = [];
function monitor(page: Page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
}
async function audit(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  accessibility.push({ label, violations: result.violations });
  expect(result.violations, label + " accessibility").toEqual([]);
}
try {
  const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1024 },
      reducedMotion: "reduce",
    }),
    page = await desktop.newPage();
  monitor(page);
  await page.goto(url);
  await expect(page.locator(".home h1")).toContainText("Влада починається");
  await expect(page.locator(".board canvas")).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({
    path: resolve(artifacts, "home-desktop.png"),
    fullPage: true,
  });
  await audit(page, "home");
  checks.push("production build in /vada/, Babylon canvas, home accessibility");
  await page
    .getByRole("button", { name: "Почати партію", exact: false })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await audit(page, "practice setup");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Почати партію", exact: false }).first(),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Почати партію", exact: false })
    .first()
    .click();
  await page.getByLabel("Склад партії").selectOption("3");
  await page.getByRole("button", { name: "Почати тренувальну партію" }).click();
  await page.getByRole("button", { name: "Перейти й купити · 80 ◈" }).click();
  await expect(page.locator(".asset-detail")).toContainText("Власник: Ви");
  await page.reload();
  await page
    .getByRole("button", { name: "Продовжити тренування", exact: false })
    .click();
  await expect(page.locator(".asset-detail")).toContainText("Власник: Ви");
  await expect(page.locator(".board canvas")).toBeVisible();
  await page.getByRole("button", { name: "Плоска карта", exact: true }).click();
  await expect(page.locator(".flat-board")).toBeVisible();
  await page
    .getByRole("button", { name: "Об’ємна карта", exact: true })
    .click();
  await expect(page.locator(".board canvas")).toBeVisible();
  await page.screenshot({
    path: resolve(artifacts, "game-desktop.png"),
    fullPage: true,
  });
  await audit(page, "practice match");
  checks.push(
    "dialog Escape and focus return, purchase, reload save, flat/3D toggle",
  );
  // Fixed scenario proves that targeted cards respect the selected asset.
  const fixture = createGame(
    CREATURES.slice(0, 3).map((c, i) => ({
      id: i ? "bot" + i : "self",
      name: i ? c.id : "Ви",
      creature: c.id,
      bot: false,
    })),
    42,
    Date.now(),
    { turn: 0, reaction: 0, proposal: 0, debate: 0, vote: 0 },
  );
  fixture.assets.market.owner = "self";
  fixture.assets.studio.owner = "self";
  fixture.players[0].hand = ["renovate"];
  await page.evaluate(
    (s) => localStorage.setItem("vada.practice.v02", JSON.stringify(s)),
    fixture,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Продовжити тренування", exact: false })
    .click();
  await page.locator(".hand-card").click();
  await page.getByLabel("Актив для покращення").selectOption("studio");
  await page.getByRole("button", { name: "Розіграти карту" }).click();
  const levels = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("vada.practice.v02")!);
    return [s.assets.market.level, s.assets.studio.level];
  });
  expect(levels).toEqual([0, 1]);
  checks.push("renovation selects studio, leaves market unchanged");
  const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    }),
    mobilePage = await mobile.newPage();
  monitor(mobilePage);
  await mobilePage.goto(url);
  await expect(mobilePage.locator(".board canvas")).toBeVisible();
  expect(
    await mobilePage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await mobilePage.screenshot({
    path: resolve(artifacts, "home-mobile.png"),
    fullPage: true,
  });
  await audit(mobilePage, "mobile home");
  checks.push("390px mobile layout without horizontal overflow");
  await mobile.close();
  await desktop.close();
  // Two independent players use real HTTP and WS, plus a bot to reach 3 seats.
  const hostCtx = await browser.newContext({
      viewport: { width: 1440, height: 1024 },
      reducedMotion: "reduce",
    }),
    guestCtx = await browser.newContext({
      viewport: { width: 1440, height: 1024 },
      reducedMotion: "reduce",
    });
  const host = await hostCtx.newPage(),
    guest = await guestCtx.newPage();
  monitor(host);
  monitor(guest);
  let stallNext = false,
    stalled = false;
  const retried: any[] = [];
  await host.routeWebSocket("**/ws", (ws) => {
    const peer = ws.connectToServer();
    let silent = false;
    ws.onMessage((message) => {
      const m = JSON.parse(message.toString());
      if (m.type === "command" && m.command.type === "pass") {
        retried.push(m);
        if (stallNext && !stalled) {
          silent = true;
          stalled = true;
        }
      }
      peer.send(message);
    });
    peer.onMessage((message) => {
      if (!silent) ws.send(message);
    });
  });
  async function openRoom(p: Page, name: string, code?: string) {
    await p.goto(url);
    await p
      .getByRole("button", { name: "Грати з друзями", exact: true })
      .first()
      .click();
    if (code) {
      await p
        .getByRole("group", { name: "Вибір NUMBRA" })
        .getByRole("button", { name: "TRADOR" })
        .click();
      await p
        .getByRole("button", { name: "Увійти за кодом", exact: true })
        .click();
      await p.getByLabel("Код кімнати").fill(code);
    }
    await p.getByLabel("Ваше ім’я").fill(name);
    await p
      .getByRole("button", {
        name: code ? "Увійти до кімнати" : "Створити кімнату",
        exact: true,
      })
      .last()
      .click();
    await expect(p.locator(".lobby h1")).toContainText("Зберіть");
    await expect(p.locator(".global-status")).toContainText(
      "З’єднання підтверджено",
    );
  }
  await openRoom(host, "Максим");
  const code = (await host.locator(".lobby-code > span").textContent())!;
  await openRoom(guest, "Олена", code);
  await expect(host.locator(".lobby-members")).toContainText("Олена");
  await host.getByRole("button", { name: "Додати бота", exact: true }).click();
  await expect(host.locator(".lobby-members article")).toHaveCount(3);
  await host
    .getByRole("button", { name: "Почати партію", exact: true })
    .click();
  await expect(host.locator(".game")).toBeVisible();
  await expect(guest.locator(".game")).toBeVisible();
  await host.getByRole("button", { name: "Угоди", exact: true }).click();
  await host.getByLabel("Віддаю монет").fill("50");
  await host.getByRole("button", { name: "Запропонувати обмін" }).click();
  await guest.getByRole("button", { name: "Угоди", exact: true }).click();
  await expect(guest.locator(".offer")).toContainText("Віддає 50");
  await guest.getByRole("button", { name: "Прийняти", exact: true }).click();
  await expect(host.locator(".players-strip")).toContainText("350 ◈");
  await expect(guest.locator(".players-strip")).toContainText("450 ◈");
  await host.getByRole("button", { name: "Чат", exact: true }).click();
  await host.getByLabel("Ваше повідомлення").fill("Зустрінемось у парламенті.");
  await host.getByRole("button", { name: "Надіслати", exact: true }).click();
  await guest.getByRole("button", { name: "Чат", exact: true }).click();
  await expect(guest.locator(".chat-history")).toContainText(
    "Зустрінемось у парламенті.",
  );
  await expect(host.getByLabel("Ваше повідомлення")).toHaveValue("");
  checks.push(
    "two players + bot, private room, atomic trade, acknowledged chat",
  );
  await host.getByRole("button", { name: "Дії", exact: true }).click();
  stallNext = true;
  await host
    .getByRole("button", { name: "Зібрати підтримку", exact: false })
    .click();
  await expect(host.locator(".global-status")).toContainText(
    "З’єднання підтверджено",
    { timeout: 22000 },
  );
  await expect(host.locator(".players-strip")).toContainText("370 ◈", {
    timeout: 22000,
  });
  expect(retried.length).toBe(2);
  expect(retried[0]).toEqual(retried[1]);
  expect(api.manager.rooms.get(code)!.game!.totalTurns).toBe(1);
  checks.push(
    "dropped initial acknowledgment triggers reconnect and same-ID replay exactly once",
  );
  await host.reload();
  await host
    .getByRole("button", { name: "Повернутись до кімнати", exact: false })
    .click();
  await expect(host.locator(".game")).toBeVisible();
  await expect(host.locator(".players-strip")).toContainText("370 ◈");
  await audit(host, "online match");
  checks.push("reload restores original private seat");
  expect(errors).toEqual([]);
  await writeFile(
    resolve("docs/browser-report.json"),
    JSON.stringify(
      {
        status: "passed",
        at: new Date().toISOString(),
        browser: await browser.version(),
        checks,
        errors,
        accessibility,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    JSON.stringify({ status: "passed", checks }, null, 2) + "\n",
  );
} catch (error) {
  await writeFile(
    resolve("docs/browser-report.json"),
    JSON.stringify(
      { status: "failed", error: String(error), checks, errors, accessibility },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
  await api.close();
  await new Promise<void>((resolve) => web.close(() => resolve()));
}
