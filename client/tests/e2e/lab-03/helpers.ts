import { expect, type Page } from '@playwright/test';

// Shared E2E helpers (Lab 3 Issue 9, #107). Each spec uses a DEDICATED seeded
// account so specs never fight over rotated passwords or tickets.
export const SEED_PASSWORD = 'TokTickDemo123!';
export const E2E_PASSWORD = 'E2E-NewPass123!';

function uniqueTitle(prefix: string): string {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${prefix} ${ts}-${Math.floor(Math.random() * 1000)}`;
}

/** Log in, tolerating both fresh-seed (must change password) and rotated states. */
export async function login(page: Page, email: string): Promise<void> {
  const banner = page.getByTestId('login-error');
  const changeForm = page.getByTestId('change-password-form');

  // Wait for EITHER navigation away from /login OR the 401 banner. A fixed
  // waitForURL-then-banner sequence flakes when the response lands between
  // the two waits (banner arrives just after waitForURL times out).
  async function waitLoginSettled(): Promise<'navigated' | 'banner'> {
    await expect
      .poll(
        async (): Promise<string> => {
          if (!new URL(page.url()).pathname.includes('/login')) return 'navigated';
          if (await banner.isVisible().catch(() => false)) return 'banner';
          return 'waiting';
        },
        { timeout: 30000 },
      )
      .not.toBe('waiting');
    if (!new URL(page.url()).pathname.includes('/login')) return 'navigated';
    return 'banner';
  }

  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(SEED_PASSWORD);
  await page.getByTestId('login-submit').click();
  if ((await waitLoginSettled()) === 'banner') {
    // Safe 401 — the account was rotated by an earlier run; retry with it.
    await page.getByTestId('login-password').fill(E2E_PASSWORD);
    await page.getByTestId('login-submit').click();
    const outcome = await waitLoginSettled();
    if (outcome === 'banner') throw new Error(`Login failed for ${email} with both known passwords.`);
  }
  // Either the role home (already rotated) or the mandatory change form.
  const { pathname } = new URL(page.url());
  if (pathname.includes('/my-tickets') || pathname.includes('/queue')) return;
  await expect(changeForm).toBeVisible({ timeout: 10000 });
  const notChangePw = (url: URL) => !url.pathname.includes('/change-password');
  await rotatePassword(page, SEED_PASSWORD);
  await page.waitForURL(notChangePw, { timeout: 20000 }).catch(() => undefined);
  if (page.url().includes('/change-password')) {
    // Still here — the seeded password is no longer current (an earlier run
    // rotated it). The error banner must be showing; retry with it.
    await expect(page.getByTestId('change-password-error')).toBeVisible({ timeout: 10000 });
    await rotatePassword(page, E2E_PASSWORD);
    await page.waitForURL(notChangePw, { timeout: 20000 });
  }
}

async function rotatePassword(page: Page, current: string): Promise<void> {
  await page.getByTestId('change-current').fill(current);
  await page.getByTestId('change-new').fill(E2E_PASSWORD);
  await page.getByTestId('change-confirm').fill(E2E_PASSWORD);
  await page.getByTestId('change-submit').click();
}

export async function logout(page: Page): Promise<void> {
  // Desktop exposes Log out inside the profile dropdown; the mobile nav
  // exposes it after opening the hamburger menu. Always click the
  // *visible* one — both variants exist in the DOM on desktop widths.
  const visibleLogout = () => page.locator('button:visible', { hasText: 'Log out' });
  if ((await visibleLogout().count()) === 0) {
    const profile = page.getByRole('button', { name: /signed in as/i });
    if (await profile.isVisible().catch(() => false)) {
      await profile.click();
    } else {
      const menu = page.getByRole('button', { name: /navigation menu/i });
      if (await menu.isVisible().catch(() => false)) await menu.click();
    }
  }
  await visibleLogout().first().click();
  // Logout races the ProtectedRoute bounce: the landing URL may carry a
  // ?redirect= query, so match the /login prefix, not the exact end.
  await page.waitForURL('**/login**');
}

/** Create a ticket as the signed-in requester; returns its ticket number. */
export async function createTicket(page: Page, title: string): Promise<string> {
  await page.goto('/create-ticket');
  await expect(page.getByTestId('create-ticket-form')).toBeVisible();
  await page.getByTestId('field-title').fill(title);
  await page.getByTestId('field-category').selectOption({ index: 1 });
  await page.getByTestId('field-system').selectOption({ index: 1 });
  await page.getByTestId('field-priority').selectOption('LOW');
  await page.getByTestId('field-description').fill(`E2E regression ticket: ${title}.`);
  await page.getByRole('button', { name: 'Submit Ticket' }).click();
  await expect(page.getByTestId('create-ticket-success')).toBeVisible();
  return (await page.getByTestId('ticket-no').innerText()).trim();
}

export { uniqueTitle };

/**
 * Open the first list entry regardless of viewport: wide screens render
 * tables (`ticket-row` / `queue-row`), narrow screens render cards
 * (`ticket-card` / `queue-card`). Tablet sits between the two breakpoints
 * (My Tickets table at md+, queue table at lg+), so probe visibility.
 */
export async function openFirstEntry(page: Page, kind: 'ticket' | 'queue'): Promise<void> {
  // Wait (don't instant-probe): the list renders after the API responds, and
  // an immediate isVisible() races the fetch and picks the wrong layout.
  const row = page.getByTestId(`${kind}-row`).first();
  try {
    await row.waitFor({ state: 'visible', timeout: 10000 });
    await row.click();
    return;
  } catch {
    await page.getByTestId(`${kind}-card`).first().click();
  }
}

/** Assert the list body is visible in whichever layout the viewport uses. */
export async function expectListVisible(page: Page, kind: 'ticket' | 'queue'): Promise<void> {
  // NB: the requester table id is plural (tickets-table).
  const tableId = kind === 'ticket' ? 'tickets-table' : 'queue-table';
  // Poll until EITHER layout is visible — no instant probe that can race
  // the data fetch and commit to the hidden layout's locator.
  await expect
    .poll(
      async () => {
        if (await page.getByTestId(tableId).isVisible().catch(() => false)) return true;
        if (await page.getByTestId(`${kind}-card`).first().isVisible().catch(() => false))
          return true;
        return false;
      },
      { timeout: 15000 },
    )
    .toBe(true);
}
