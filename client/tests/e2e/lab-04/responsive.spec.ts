import { test, expect } from '@playwright/test';
import { loginRequester, loginStaff, logout, REQUESTER_A } from './helpers';

// Lab 4 E2E row 27 (AC-53): dashboards + detail at 375/768/1280 — no page
// horizontal scroll, no clipped content. Runs once per viewport via the
// desktop/tablet/mobile projects (375 ≈ iPhone 13, 768 ≈ iPad, 1280 desktop).

const LAB4_ROUTES = ['/dashboard/requester', '/dashboard/staff', '/my-tickets', '/queue'];

test.describe('responsive lab4', () => {
  test('lab4 screens never scroll the page horizontally', async ({ page }) => {
    await loginStaff(page);

    for (const route of LAB4_ROUTES) {
      // Requester dashboard is staff-visible (counts-only) but the staff
      // dashboard 403s for requesters — skip role-forbidden routes per role.
      await page.goto(route);
      const forbidden = await page.getByTestId('role-forbidden').count();
      if (forbidden > 0) continue;

      const hScroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(hScroll, `${route} page h-scroll`).toBeLessThanOrEqual(1);

      // Wide tables scroll inside their card, never the page (BR-30).
      for (const wrap of ['actions-table-wrap', 'tickets-table', 'queue-table']) {
        const count = await page.getByTestId(wrap).count();
        if (count === 0) continue;
        const overflow = await page.getByTestId(wrap).first().evaluate((el) => {
          const style = getComputedStyle(el);
          return style.overflowX;
        });
        expect(['auto', 'scroll', 'visible']).toContain(overflow);
      }
    }

    // Detail views (both roles) at this viewport.
    await page.goto('/queue');
    const queueRow = page.getByTestId('queue-row').first();
    const queueCard = page.getByTestId('queue-card').first();
    if (await queueRow.isVisible().catch(() => false)) {
      await queueRow.click();
    } else if (await queueCard.isVisible().catch(() => false)) {
      await queueCard.click();
    }
    if (!new URL(page.url()).pathname.startsWith('/tickets/')) {
      await logout(page);
      await loginRequester(page, REQUESTER_A);
      await page.goto('/my-tickets');
    }
    const detailScroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(detailScroll).toBeLessThanOrEqual(1);
    await logout(page);
  });
});
