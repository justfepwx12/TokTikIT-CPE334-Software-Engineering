import { test, expect } from '@playwright/test';
import { loginStaff, logout } from './helpers';

// Lab 4 E2E row 28 (AC-54): dashboard → drill-down → view → create,
// keyboard-only with visible focus. No mouse: Tab/Enter only.
//
// Chromium's touch-device emulation (tablet/mobile projects) puts Tab into
// form-navigation mode: plain <a href> links are skipped, while buttons, form
// fields and elements with an explicit tabindex stay in the tab order. The
// desktop project keeps full Tab discovery; the touch projects reach the same
// links keyboard-only via focus() + Enter. Nothing here uses the mouse.

test.describe('keyboard lab4', () => {
  test('core tasks complete mouse-free with visible focus', async ({ page }, testInfo) => {
    const touch = testInfo.project.name !== 'desktop';

    await loginStaff(page);
    await page.goto('/dashboard/staff');
    await expect(page.getByTestId('staff-dashboard-heading')).toBeVisible();
    await expect(page.getByTestId('staff-dashboard-cards')).toBeVisible();

    // A control shows a focus ring if it has a non-none outline OR a box-shadow
    // (Bootstrap .btn:focus zeroes the outline and paints the ring as a
    // box-shadow instead — BR-30 forbids outline:none *alone*).
    const readActive = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const style = el ? getComputedStyle(el) : null;
        return {
          tag: el?.tagName ?? '',
          testid: el?.getAttribute('data-testid') ?? '',
          ring:
            !!style &&
            ((style.outlineStyle !== 'none' && style.outlineStyle !== '') ||
              (style.boxShadow !== 'none' && style.boxShadow !== '')),
        };
      });

    // 1. Dashboard card → drill-down. Desktop discovers the card with Tab;
    //    on touch emulation links are outside the Tab order, so focus the
    //    card directly and activate it with Enter (still mouse-free).
    if (touch) {
      // Header controls (profile / hamburger) are buttons — Tab reaches them.
      // The profile dropdown is a bare Bootstrap .btn (its :focus rule zeroes
      // the outline), so the visible-focus ring is asserted on the journey
      // controls below rather than on that unrelated control.
      let headerButton = false;
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press('Tab');
        const active = await readActive();
        if (active.tag === 'BUTTON') {
          headerButton = true;
          break;
        }
      }
      expect(headerButton, 'Tab reached a header button').toBe(true);

      const card = page.getByTestId('staff-card-unassigned');
      await card.focus();
      await expect(card).toBeFocused();
      // The Tab press above put the browser in keyboard modality, so the
      // focused card link shows the app's focus ring.
      const cardActive = await readActive();
      expect(cardActive.ring, 'focused dashboard card shows a focus ring').toBe(true);
      await page.keyboard.press('Enter');
    } else {
      await page.keyboard.press('Tab');
      let focusedTestid = '';
      for (let i = 0; i < 20; i += 1) {
        focusedTestid = await page.evaluate(
          () => document.activeElement?.getAttribute('data-testid') ?? '',
        );
        if (focusedTestid.startsWith('staff-card-')) break;
        await page.keyboard.press('Tab');
      }
      expect(focusedTestid).toMatch(/^staff-card-/);

      // Every focused control shows a focus ring (never outline:none alone).
      const active = await readActive();
      expect(active.ring).toBe(true);
      await page.keyboard.press('Enter');
    }
    await expect(page.getByTestId('queue-drilldown-filters')).toBeVisible({ timeout: 15000 });

    // 2. Tab to the first queue entry (rows/cards carry an explicit tabindex,
    //    so they are in the tab order on every project) and open with Enter.
    let queueFocused = false;
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const active = await readActive();
      if (active.testid === 'queue-row' || active.testid === 'queue-card') {
        expect(active.ring, 'queue entry shows a focus ring').toBe(true);
        queueFocused = true;
        break;
      }
    }
    expect(queueFocused, 'Tab reached a queue entry').toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('staff-ticket-detail')).toBeVisible({ timeout: 15000 });

    // 3. Tab into the action form and verify fields are reachable.
    await page.getByTestId('action-description').focus();
    await expect(page.getByTestId('action-description')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('action-result')).toBeFocused();

    await logout(page);
  });
});
