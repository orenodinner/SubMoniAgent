import path from "path";
import { test, expect, _electron as electron, ElectronApplication, Page } from "@playwright/test";

test.describe("Application Launch", () => {
  let app: ElectronApplication;

  test.beforeAll(async () => {
    app = await electron.launch({
      args: [path.join(__dirname, "../../scripts/start-electron.js")],
      env: { ...process.env, NODE_ENV: "test" },
    });
  });

  test.afterAll(async () => {
    await app.close();
  });

  test("opens a window with the correct title", async () => {
    const window = await app.firstWindow();
    await expect(window).toHaveTitle("PixelAgent");
  });

  test("shows character canvas on load", async () => {
    const window: Page = await app.firstWindow();
    const charImg = window.locator(".character-canvas");
    await expect(charImg).toBeVisible();
  });
});
