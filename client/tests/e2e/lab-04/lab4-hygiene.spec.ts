import { test, expect } from '@playwright/test';
import { loginRequester, loginStaff, logout, REQUESTER_A } from './helpers';

// Lab 4 E2E row 32 (AC-55): console-error + broken-link sweep across all
// Lab 4 screens. Fails on any pageerror/console-error or any drill-down /
// CTA that 404s. Read-only: creates nothing.

const LAB4_LINKS = [
  { route: '/dashboard/requester', heading: 'requester-dashboard-heading' },
  { route: '/dashboard/staff', heading: 'staff-dashboard-heading' },
  { route: '/my-tickets', heading: null },
  { route: '/queue', heading: null },
];

test.describe('lab4 hygiene', () => {
  test('zero console errors and zero broken links', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${String(err)}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });

    await loginStaff(page);

    for (const { route, heading } of LAB4_LINKS) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} HTTP`).toBeLessThan(400);
      if (heading) await expect(page.getByTestId(heading)).toBeVisible({ timeout: 15000 });
    }

    // Every dashboard card href resolves (no dead drill-down).
    await page.goto('/dashboard/staff');
    const cardHrefs = await page.getByTestId('staff-dashboard-cards').locator('a').evaluateAll((els) =>
      els.map((el) => el.getAttribute('href')).filter((h): h is string => !!h),
    );
    expect(cardHrefs.length).toBeGreaterThan(0);
    for (const href of cardHrefs.slice(0, 6)) {
      const res = await page.goto(href);
      expect(res?.status(), `drill-down ${href}`).toBeLessThan(400);
      expect(await page.getByTestId('role-forbidden').count()).toBe(0);
    }

    // Requester cards + follow-up strip link resolve for REQUESTER callers.
    await logout(page);
    await loginRequester(page, REQUESTER_A);
    await page.goto('/dashboard/requester');
    const reqHrefs = await page.getByTestId('requester-dashboard-cards').locator('a').evaluateAll((els) =>
      els.map((el) => el.getAttribute('href')).filter((h): h is string => !!h),
    );
    for (const href of reqHrefs.slice(0, 3)) {
      const res = await page.goto(href);
      expect(res?.status(), `requester drill-down ${href}`).toBeLessThan(400);
    }

    // Empty-state CTAs are real client routes (not the spec's old placeholders).
    await page.goto('/dashboard/requester');
    const emptyCta = page.getByTestId('requester-empty-cta');
    if ((await emptyCta.count()) > 0) {
      expect(await emptyCta.getAttribute('href')).toBe('/create-ticket');
    }

    expect(errors).toEqual([]);
    await logout(page);
  });
});
