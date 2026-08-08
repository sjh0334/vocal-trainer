import { expect, test } from "@playwright/test";

import { installSyntheticMedia } from "./support/synthetic-media.js";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__VOCAL_TRAINER_CONFIG__ = { calibrationMs: 0, countdownMs: 0 };
  });
  await page.addInitScript(installSyntheticMedia);
});

test("shows the product promise and responsive practice choices", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page).toHaveTitle("听见你的声音");
  await expect(page.getByRole("heading", { name: /听见你的声音/ })).toBeVisible();
  await expect(page.getByText("长音 A3")).toBeVisible();
  await expect(page.getByText("长音 C4")).toBeVisible();
  await expect(page.getByText("长音 E4")).toBeVisible();
  await expect(page.getByText("220 Hz").first()).toBeVisible();
  await expect(page.getByText(/本地保存，不上传/)).toBeVisible();
  if (testInfo.project.name === "mobile-chromium") {
    await expect(page.locator(".hero-orbit")).toBeHidden();
    await expect(page.locator(".hero")).toHaveCSS("grid-template-columns", /\d+px/);
    expect((await page.locator(".hero h1").boundingBox()).width).toBeGreaterThan(280);
  }
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
});

test("completes a practice, replays the recording and deletes local history", async ({
  page,
}, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");

  await page.getByRole("button", { name: /长音 A3/ }).click();
  await expect(page.getByRole("heading", { name: "长音 A3" })).toBeVisible();
  await expect(page.getByText("目标音 A3")).toBeVisible();
  await expect(page.getByText("220 Hz").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "试听目标音" })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始录制" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.__syntheticGetUserMediaCalls)).toBe(0);
  if (testInfo.project.name === "desktop-chromium") {
    await page.screenshot({ path: testInfo.outputPath("preparation.png"), fullPage: true });
  }

  await page.getByRole("button", { name: "开始录制" }).click();
  await expect.poll(() => page.evaluate(() => globalThis.__syntheticGetUserMediaCalls)).toBe(1);
  await expect(page.getByRole("heading", { name: "长音 A3" })).toBeVisible();
  await expect(page.getByText("目标 A3 · 220 Hz")).toBeVisible();
  await expect(page.getByLabel("实时音高跑道")).toBeVisible();
  await expect(page.locator("#live-note")).toHaveText("A3");
  if (testInfo.project.name === "desktop-chromium") {
    await page.screenshot({ path: testInfo.outputPath("live-runway.png"), fullPage: true });
  }

  await expect(page.getByText("本次总分")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("数据不足")).toHaveCount(0);
  await expect(
    page.locator(".score-card").filter({ hasText: "音准" }).locator("strong"),
  ).toHaveText("100");
  await expect(page.getByRole("button", { name: "播放录音" })).toBeVisible();

  const latencies = await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("vocal-trainer");
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    const records = await new Promise((resolve, reject) => {
      const request = database.transaction("sessions").objectStore("sessions").getAll();
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    return records[0].trajectory.map((point) => point.latencyMs).filter(Number.isFinite);
  });
  const sortedLatencies = latencies.toSorted((left, right) => left - right);
  const p95Latency = sortedLatencies[Math.ceil(sortedLatencies.length * 0.95) - 1];
  expect(sortedLatencies.length).toBeGreaterThan(10);
  expect(p95Latency).toBeLessThanOrEqual(150);
  await testInfo.attach("latency.json", {
    body: JSON.stringify({ sampleCount: sortedLatencies.length, p95Ms: p95Latency }, null, 2),
    contentType: "application/json",
  });
  if (testInfo.project.name === "desktop-chromium") {
    await page.screenshot({ path: testInfo.outputPath("report.png"), fullPage: true });
  }

  await page.reload();
  await page.getByRole("button", { name: /历史 1/ }).click();
  await page.getByRole("button", { name: /长音 A3/ }).click();
  await page.getByRole("button", { name: "播放录音" }).click();
  await expect(page.getByRole("button", { name: "暂停录音" })).toBeVisible();
  await expect(page.locator("#playback-time")).not.toHaveText("0.0s");

  await page.getByRole("button", { name: "返回练习" }).click();
  await page.getByRole("button", { name: /历史 1/ }).click();
  await expect(page.getByText("长音 A3")).toBeVisible();
  await page.getByRole("button", { name: "删除记录" }).click();
  await expect(page.getByText("还没有练习记录")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
