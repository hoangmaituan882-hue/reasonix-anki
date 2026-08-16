// Reasonix Anki — Tabbit Browser UI 冒烟主体（由 tabbit-smoke.ps1 调用）
// 在持久任务空间内：连接断言 → 今日学习 → 牌组浏览 → 统计概览 → 收集控制台错误
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

const out = { errors: [] };
await page.goto("http://localhost:1420", { waitUntil: "domcontentloaded", timeout: 45000 });

// 1) 连接状态：Anki 连接态 或 断线引导页 均可。
// 注意：checking 态（轮询中）也渲染断线屏（含"立即重试"），不能据此判 disconnected——
// 必须等"Anki 已连接"出现（connected）或 10s 超时（轮询 3s 周期足以出真断线结果）。
await page
  .waitForFunction(() => document.body.innerText.includes("Anki 已连接"), null, {
    timeout: 10000,
  })
  .catch(() => {});
const connected = await page.evaluate(() =>
  document.body.innerText.includes("Anki 已连接") ? "connected" : "disconnected",
);
out.connection = connected;

if (connected === "disconnected") {
  out.disconnectedScreen = await page.evaluate(() => ({
    hasGuide: document.body.innerText.includes("启动 Anki 桌面端"),
    hasRetry: document.body.innerText.includes("立即重试"),
  }));
  out.errors = errors;
  return out; // 断线态无需继续视图冒烟
}

// 2) 今日学习（默认视图）
out.today = await page.evaluate(() => ({
  hasDeckPicker:
    document.body.innerText.includes("未选牌组") ||
    document.body.innerText.includes("尚未选择牌组") ||
    document.body.innerText.includes("选择牌组") ||
    document.body.innerText.includes("开始学习"),
  hasCompanion: document.body.innerText.includes("背单词"),
}));

// 3) 牌组浏览
await page.getByRole("button", { name: "牌组浏览" }).click();
await page.waitForFunction(
  () => document.body.innerText.includes("牌组") && document.body.innerText.includes("卡片"),
  null,
  { timeout: 15000 },
);
await page.waitForTimeout(2000);
out.browse = await page.evaluate(() => ({
  hasDeckTree:
    document.body.innerText.includes("系统默认") ||
    !!document.querySelector("aside, [class*='deck-tree']"),
  hasTable: !!document.querySelector("table, [role='table']"),
  hasPagination:
    document.body.innerText.includes("上一页") || document.body.innerText.includes("下一页"),
}));

// 4) 统计概览（热力图）
await page.getByRole("button", { name: "统计概览" }).click();
await page.waitForFunction(
  () => document.body.innerText.includes("今日已复习") || document.body.innerText.includes("总卡片"),
  null,
  { timeout: 15000 },
);
await page.waitForTimeout(2500);
out.stats = await page.evaluate(() => ({
  hasSummary:
    document.body.innerText.includes("今日已复习") || document.body.innerText.includes("总卡片"),
  heatmapCells: document.querySelectorAll("[class*='aspect-square'], [class*='rx-liquid']").length,
}));

out.errors = errors;
return out;
