// @ts-check
const { test, expect } = require('@playwright/test');

// Runs in chromium, firefox and webkit (see playwright.config.js).
test('phone width: the palette story table scrolls inside its box, not the page', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('./');
  await expect(page.locator('.story-table')).toBeAttached();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
