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
  const notLogin = (url: URL) => !url.pathname.includes('/login');

  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(SEED_PASSWORD);
  await page.getByTestId('login-submit').click();
  // Either we leave /login (success) or the safe 401 banner appears.
  await page.waitForURL(notLogin, { timeout: 20000 }).catch(() => undefined);
  if (page.url().includes('/login')) {
    // Safe 401 — the account was rotated by an earlier run; retry with it.
    await expect(banner).toBeVisible({ timeout: 10000 });
    await page.getByTestId('login-password').fill(E2E_PASSWORD);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(notLogin, { timeout: 20000 });
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
  // The desktop Log out action lives inside the profile dropdown; the mobile
  // nav exposes it after opening the hamburger menu.
  const profile = page.getByRole('button', { name: /signed in as/i });
  if (await profile.isVisible().catch(() => false)) {
    await profile.click();
  } else {
    const menu = page.getByRole('button', { name: /navigation menu/i });
    if (await menu.isVisible().catch(() => false)) await menu.click();
  }
  await page.getByText('Log out').first().click();
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
