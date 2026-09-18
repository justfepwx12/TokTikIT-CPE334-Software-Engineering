import { test, expect } from '@playwright/test';
import { login, logout, SEED_PASSWORD } from './helpers';

// Lab 3 E2E: authentication lifecycle (AC-01–AC-07, tests.md row 62).
// Uses kanya.boonmee (dedicated seeded requester).
const EMAIL = 'kanya.boonmee@toktikit.com';

test.describe('auth flow', () => {
  test('wrong password shows a safe banner without account hints', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(EMAIL);
    await page.getByTestId('login-password').fill('definitely-wrong');
    await page.getByTestId('login-submit').click();
    const banner = page.getByTestId('login-error');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Invalid email or password.');
    // Screenshot matrix (#109): paths resolve against the client package dir.
    await page.screenshot({ path: `../docs/lab-03/images/e2e-login-${test.info().project.name}.png` });
  });

  test('login → session restore on reload → logout', async ({ page }) => {
    await login(page, EMAIL);
    await page.waitForURL('**/my-tickets');
    await expect(page.getByTestId('ticket-search')).toBeVisible();

    // Session restore: a full reload keeps the user signed in (AC-04).
    await page.reload();
    await expect(page.getByTestId('ticket-search')).toBeVisible();

    await logout(page);
    // Session is gone: protected routes bounce back to login (AC-05/AC-11).
    await page.goto('/my-tickets');
    await page.waitForURL('**/login**');
  });

  test('inactive accounts get the same safe 401 message (AC-03)', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill('napat.wongsawat@toktikit.com');
    await page.getByTestId('login-password').fill(SEED_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toContainText('Invalid email or password.');
  });
});
