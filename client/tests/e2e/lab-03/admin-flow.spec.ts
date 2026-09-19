import { test, expect } from '@playwright/test';
import { login, logout, SEED_PASSWORD, E2E_PASSWORD } from './helpers';

// Lab 3 E2E: admin user administration (AC-26–AC-29, tests.md row 65).
// Uses the seeded admin (admin@toktikit.com, no forced password change).
const ADMIN = 'admin@toktikit.com';
const TEMP_PASSWORD = 'E2E-Temp123!';
const RESET_PASSWORD = 'E2E-Reset123!';

function uniqueEmail(): string {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `e2eadm-${ts}-${Math.floor(Math.random() * 1000)}@toktikit.com`;
}

test.describe('admin user administration', () => {
  test('create user, 409 duplicate, self-deactivate blocked, reset → next-login change', async ({
    page,
  }) => {
    const email = uniqueEmail();

    await login(page, ADMIN);
    await page.goto('/users');
    await expect(page.getByTestId('user-row').first()).toBeVisible();
    await page.screenshot({ path: `../docs/lab-03/images/e2e-users-${test.info().project.name}.png` });

    // 1. Create a requester (AC-26).
    await page.getByTestId('user-create-open').click();
    await page.getByTestId('user-form-name').fill('E2E Admin Created');
    await page.getByTestId('user-form-email').fill(email);
    await page.getByTestId('user-form-role').selectOption('REQUESTER');
    await page.getByTestId('user-form-password').fill(TEMP_PASSWORD);
    await page.getByTestId('user-form-save').click();
    const createdRow = page.getByTestId('user-row').filter({ hasText: email });
    await expect(createdRow).toBeVisible();

    // 2. Duplicate email → 409 feedback against the email field (AC-27).
    await page.getByTestId('user-create-open').click();
    await page.getByTestId('user-form-name').fill('E2E Duplicate');
    await page.getByTestId('user-form-email').fill(email);
    await page.getByTestId('user-form-password').fill(TEMP_PASSWORD);
    await page.getByTestId('user-form-save').click();
    await expect(page.getByText('A user with this email already exists.')).toBeVisible();
    await page.keyboard.press('Escape');

    // 3. Self-deactivation is blocked with a guard message (AC-28).
    const ownRow = page.getByTestId('user-row').filter({ hasText: '(you)' });
    await expect(ownRow).toBeVisible();
    await ownRow.getByRole('button', { name: 'Edit' }).click();
    await page.getByTestId('user-form-active').uncheck();
    await page.getByTestId('user-form-save').click();
    await expect(page.getByTestId('user-form-banner')).toContainText(
      'You cannot deactivate your own account.'
    );
    await page.keyboard.press('Escape');

    // 4. Reset the created user's password (AC-26).
    await createdRow.getByRole('button', { name: 'Reset password' }).click();
    await page.getByTestId('reset-password-input').fill(RESET_PASSWORD);
    await page.getByTestId('reset-submit').click();
    await expect(page.getByTestId('reset-success')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    // 5. The reset user logs in with the temporary password and must
    // change it before reaching their home (BR-03).
    await logout(page);
    await page.goto('/login');
    await page.getByTestId('login-email').fill(email);
    await page.getByTestId('login-password').fill(RESET_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('change-password-form')).toBeVisible();
    await page.getByTestId('change-current').fill(RESET_PASSWORD);
    await page.getByTestId('change-new').fill(E2E_PASSWORD);
    await page.getByTestId('change-confirm').fill(E2E_PASSWORD);
    await page.getByTestId('change-submit').click();
    await page.waitForURL('**/my-tickets');
    await expect(page.getByTestId('ticket-search')).toBeVisible();

    await logout(page);
    // Sanity: the seeded admin password is untouched by the flow.
    await page.goto('/login');
    await page.getByTestId('login-email').fill(ADMIN);
    await page.getByTestId('login-password').fill(SEED_PASSWORD);
    await page.getByTestId('login-submit').click();
    await page.waitForURL('**/queue');
    await logout(page);
  });
});
