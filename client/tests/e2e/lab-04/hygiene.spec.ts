import { test, expect, type Page } from '@playwright/test';
import { loginRequester, loginStaff, logout, REQUESTER_A } from './helpers';

// Lab 4 E2E row 32 (AC-55): console-error + broken-link sweep across all
// Lab 4 screens. Fails on any pageerror/console-error or any drill-down /
// CTA that 404s. Read-only: creates nothing.

// Staff-phase sweep. /my-tickets is deliberately NOT in this list: its API
// (GET /api/tickets) is REQUESTER-only, so a staff visit fires a legitimate
// but sweep-failing 403 — it is swept in the requester phase below instead.
const STAFF_LINKS = [
  { route: '/dashboard/requester', heading: 'requester-dashboard-heading' },
  { route: '/dashboard/staff', heading: 'staff-dashboard-heading' },
  { route: '/queue', heading: null },
];

// Navigate, then let the new document's session-restore /api/auth/me probe
// (and the page's data fetches) settle before the next teardown. Without the
// networkidle wait, the next page.goto can abort that in-flight probe; the
// browser then surfaces an uncatchable "Fetch API cannot load ... /api/auth/me"
// pageerror even though nothing is actually wrong with the app.
async function gotoSettled(page: Page, url: string) {
  const response = await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  return response;
}

// Playwright reports navigation-cancelled requests with either the Chromium
// error code or its mapped description, depending on platform/version —
// both observed as "Load request cancelled" / net::ERR_ABORTED on this stack.
const CANCELLED_ERROR_TEXTS = new Set(['net::ERR_ABORTED', 'Load request cancelled']);
const AUTH_PROBE_PATHS = ['/api/auth/me', '/api/auth/login'];

test.describe('screen hygiene', () => {
  test('zero console errors and zero broken links', async ({ page }) => {
    const errors: string[] = [];
    // Confirmed-cancelled auth probes: a requestfailed for an auth-probe
    // endpoint whose errorText is a navigation cancellation. Only these can
    // excuse a matching "Fetch API cannot load" pageerror below; a genuine
    // CORS/network failure carries a different errorText (or no cancelled
    // request at all) and stays fatal.
    const cancelledAuthPaths = new Set<string>();
    page.on('requestfailed', (req) => {
      const errorText = req.failure()?.errorText;
      if (errorText === undefined || !CANCELLED_ERROR_TEXTS.has(errorText)) return;
      try {
        const { pathname } = new URL(req.url());
        if (AUTH_PROBE_PATHS.includes(pathname)) cancelledAuthPaths.add(pathname);
      } catch {
        // Unparseable URL — not an auth probe; ignore here.
      }
    });
    // "Fetch API cannot load" pageerrors are stashed rather than judged on
    // arrival: the requestfailed event can land after the exception surfaces,
    // so they are resolved against the confirmed-cancelled set just before
    // the assertions. Every other pageerror is fatal immediately.
    const unconfirmedFetchErrors: string[] = [];
    page.on('pageerror', (err) => {
      const text = String(err);
      if (text.startsWith('Fetch API cannot load')) {
        unconfirmedFetchErrors.push(text);
        return;
      }
      errors.push(`pageerror: ${text}`);
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

    for (const { route, heading } of STAFF_LINKS) {
      const response = await gotoSettled(page, route);
      expect(response?.status(), `${route} HTTP`).toBeLessThan(400);
      if (heading) await expect(page.getByTestId(heading)).toBeVisible({ timeout: 15000 });
    }

    // Every dashboard card href resolves (no dead drill-down). Wait for the
    // loaded state first — during the summary fetch only the skeleton is on
    // screen and evaluateAll would silently return an empty href list.
    await gotoSettled(page, '/dashboard/staff');
    await expect(page.getByTestId('staff-dashboard-cards')).toBeVisible({ timeout: 15000 });
    const cardHrefs = await page.getByTestId('staff-dashboard-cards').locator('a').evaluateAll((els) =>
      els.map((el) => el.getAttribute('href')).filter((h): h is string => !!h),
    );
    expect(cardHrefs.length).toBeGreaterThan(0);
    for (const href of cardHrefs.slice(0, 6)) {
      const res = await gotoSettled(page, href);
      expect(res?.status(), `drill-down ${href}`).toBeLessThan(400);
      expect(await page.getByTestId('role-forbidden').count()).toBe(0);
    }

    // Requester list + cards + follow-up strip link resolve for REQUESTER
    // callers. /my-tickets belongs to this phase — its GET /api/tickets is
    // REQUESTER-only, so sweeping it as staff would fire a real 403.
    await logout(page);
    await loginRequester(page, REQUESTER_A);
    await gotoSettled(page, '/my-tickets');
    await expect(page.getByTestId('ticket-search')).toBeVisible({ timeout: 15000 });
    await gotoSettled(page, '/dashboard/requester');
    await expect(page.getByTestId('requester-dashboard-cards')).toBeVisible({ timeout: 15000 });
    const reqHrefs = await page.getByTestId('requester-dashboard-cards').locator('a').evaluateAll((els) =>
      els.map((el) => el.getAttribute('href')).filter((h): h is string => !!h),
    );
    for (const href of reqHrefs.slice(0, 3)) {
      const res = await gotoSettled(page, href);
      expect(res?.status(), `requester drill-down ${href}`).toBeLessThan(400);
    }

    // Empty-state CTAs are real client routes (not the spec's old placeholders).
    await gotoSettled(page, '/dashboard/requester');
    const emptyCta = page.getByTestId('requester-empty-cta');
    if ((await emptyCta.count()) > 0) {
      expect(await emptyCta.getAttribute('href')).toBe('/create-ticket');
    }

    // Resolve stashed "Fetch API cannot load" pageerrors: excused only when
    // the same auth-probe endpoint has a requestfailed confirmed as a
    // navigation cancellation. Non-auth endpoints and unconfirmed auth
    // failures (genuine CORS/network errors) stay fatal.
    for (const text of unconfirmedFetchErrors) {
      const authPath = AUTH_PROBE_PATHS.find((path) => text.includes(path));
      if (authPath === undefined || !cancelledAuthPaths.has(authPath)) {
        errors.push(`pageerror: ${text}`);
      }
    }

    expect(badResponses, 'no unexpected API failures').toEqual([]);
    expect(errors).toEqual([]);
    await logout(page);
  });
});
