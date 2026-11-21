// Motion button in a browser that asks for reduced motion: the gallery light is on by default.
const { test, expect } = require('@playwright/test');

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const toggle = '[data-motion-toggle]';
const lightX = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lx').trim());

test('moving by default, off after the button, remembered after reload', async ({ page }) => {
  await page.goto('./');
  const html = page.locator('html');
  const button = page.locator(toggle);
  await expect(html).toHaveAttribute('data-motion', 'on');
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toHaveAccessibleName('Pause motion');
  await page.mouse.move(100, 300);
  await page.mouse.move(120, 310);
  await expect.poll(() => lightX(page)).not.toBe('50.00%');
  await button.click();
  await expect(html).toHaveAttribute('data-motion', 'off');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(button).toHaveAccessibleName('Play motion');
  await page.reload();
  await expect(html).toHaveAttribute('data-motion', 'off');
  await page.mouse.move(100, 300);
  await page.mouse.move(120, 310);
  await page.waitForTimeout(100);
  expect(await lightX(page)).toBe('50.00%');
  await button.click();
  await expect(html).toHaveAttribute('data-motion', 'on');
  await page.reload();
  await expect(html).toHaveAttribute('data-motion', 'on');
});
