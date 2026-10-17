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

test.describe('screen hygiene', () => {
  test('zero console errors and zero broken links', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      const text = String(err);
      // Tearing a document down (page.goto to the next drill-down) while the
      // session-restore probe is still in flight aborts that fetch, which the
      // browser reports as a CORS-flavoured pageerror. It is the intentional
      // /auth/me (or login-retry) probe, and the response listener below is
      // the authoritative network assertion — don't double-count it here.
      const abortedAuthProbe =
        text.startsWith('Fetch API cannot load') &&
        (text.includes('/api/auth/me') || text.includes('/api/auth/login'));
      if (!abortedAuthProbe) errors.push(`pageerror: ${text}`);
    });
    page.on('console', (msg) => {
      // Browser network failures surface as generic console errors with no
      // URL, so they are covered by the response check below instead (which
      // can tell an expected auth probe from a real API failure).
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        errors.push(`console: ${msg.text()}`);
      }
    });

    // Any non-ok API response fails the sweep, EXCEPT the two intentional auth
    // probes of the login flow: the session-restore /auth/me on the login page
    // (401 = not signed in) and the rotation-tolerant login retry with the
    // superseded seed password (401 before the rotated password succeeds).
    const badResponses: string[] = [];
    page.on('response', (res) => {
      const status = res.status();
      if (status < 400) return;
      const { pathname } = new URL(res.url());
      const expectedAuthProbe =
        status === 401 && (pathname === '/api/auth/me' || pathname === '/api/auth/login');
      if (!expectedAuthProbe) {
        badResponses.push(`${status} ${res.request().method()} ${pathname}`);
      }
    });

    await loginStaff(page);

    for (const { route, heading } of LAB4_LINKS) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} HTTP`).toBeLessThan(400);
      if (heading) await expect(page.getByTestId(heading)).toBeVisible({ timeout: 15000 });
    }

    // Every dashboard card href resolves (no dead drill-down). Wait for the
    // loaded state first — during the summary fetch only the skeleton is on
    // screen and evaluateAll would silently return an empty href list.
    await page.goto('/dashboard/staff');
    await expect(page.getByTestId('staff-dashboard-cards')).toBeVisible({ timeout: 15000 });
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
    await expect(page.getByTestId('requester-dashboard-cards')).toBeVisible({ timeout: 15000 });
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

    expect(badResponses, 'no unexpected API failures').toEqual([]);
    expect(errors).toEqual([]);
    await logout(page);
  });
});
