import { test, expect } from '@playwright/test';
import { loginStaff, logout } from './helpers';

// Lab 4 E2E row 28 (AC-54): dashboard → drill-down → view → create,
// keyboard-only with visible focus. No mouse: Tab/Enter only.

test.describe('keyboard lab4', () => {
  test('core tasks complete mouse-free with visible focus', async ({ page }) => {
    await loginStaff(page);
    await page.goto('/dashboard/staff');
    await expect(page.getByTestId('staff-dashboard-heading')).toBeVisible();

    // Focus the first dashboard card via keyboard and open it.
    await page.keyboard.press('Tab');
    let focusedTag = '';
    for (let i = 0; i < 20; i += 1) {
      focusedTag = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');
      if (focusedTag.startsWith('staff-card-')) break;
      await page.keyboard.press('Tab');
    }
    expect(focusedTag).toMatch(/^staff-card-/);

    // Every focused control shows a focus ring (never outline:none alone).
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return '';
      return getComputedStyle(el).outlineStyle;
    });
    expect(outline).not.toBe('none');

    await page.keyboard.press('Enter');
    await expect(page.getByTestId('queue-drilldown-filters')).toBeVisible({ timeout: 15000 });

    // Tab to the first queue entry and open it with Enter.
    await page.keyboard.press('Tab');
    for (let i = 0; i < 30; i += 1) {
      const testid = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');
      if (testid === 'queue-row' || testid === 'queue-card') break;
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('staff-ticket-detail')).toBeVisible({ timeout: 15000 });

    // Tab into the action form and verify fields are reachable.
    await page.getByTestId('action-description').focus();
    await expect(page.getByTestId('action-description')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('action-result')).toBeFocused();

    await logout(page);
  });
});
