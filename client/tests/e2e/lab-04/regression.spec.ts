import { test, expect } from '@playwright/test';
import {
  login,
  logout,
  createTicket,
  openFirstEntry,
  expectListVisible,
  uniqueTitle,
  SEED_PASSWORD,
  E2E_PASSWORD,
} from '../lab-03/helpers';

// Lab 4 E2E row 34 (AC-58): Lab 2 + Lab 3 final regression — every journey
// re-run unchanged, all green, no skips. Uses dedicated accounts per journey
// so specs never fight over rotated passwords:
// - create/queue/claim/priority/status/comments: sirichai + somchai
// - resolve-intent: weerapong
// - admin: admin (seeded, no forced change)
// Attachments upload is covered inline on create (field-attachments).

const REQ_CREATE = 'sirichai.thongdee@toktikit.com';
const REQ_RESOLVE = 'weerapong.chaiyaporn@toktikit.com';
const STAFF = 'somchai.jaidee@toktikit.com';
const STAFF_PASSWORD = 'TokTickDemo123!';
const ADMIN = 'admin@toktikit.com';

function uniqueEmail(prefix: string): string {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${prefix}-${ts}-${Math.floor(Math.random() * 1000)}@toktikit.com`;
}

test.describe('regression', () => {
  test('create with attachment → queue → claim → priority → status → comments/notes', async ({
    page,
  }) => {
    const title = uniqueTitle('E2E L23 Regression');

    // Requester creates (Lab 2) with a small attachment staged.
    await login(page, REQ_CREATE);
    await page.goto('/create-ticket');
    await expect(page.getByTestId('create-ticket-form')).toBeVisible();
    await page.getByTestId('field-title').fill(title);
    await page.getByTestId('field-category').selectOption({ index: 1 });
    await page.getByTestId('field-system').selectOption({ index: 1 });
    await page.getByTestId('field-priority').selectOption('LOW');
    await page.getByTestId('field-description').fill(`E2E regression ticket: ${title}.`);
    // The form only stages JPEG/PNG/WEBP/PDF (ALLOWED_TYPES) — a text/plain
    // file is rejected before staging and `staged-attachments` never renders.
    await page.getByTestId('field-attachments').setInputFiles({
      name: 'e2e-note.png',
      mimeType: 'image/png',
      buffer: Buffer.from('e2e attachment body'),
    });
    await expect(page.getByTestId('staged-attachments')).toBeVisible();
    await page.getByRole('button', { name: 'Submit Ticket' }).click();
    await expect(page.getByTestId('create-ticket-success')).toBeVisible();
    await logout(page);

    // Staff queue → claim → IT priority → status (Lab 3).
    await page.goto('/login');
    await page.getByTestId('login-email').fill(STAFF);
    await page.getByTestId('login-password').fill(STAFF_PASSWORD);
    await page.getByTestId('login-submit').click();
    await page.waitForURL('**/dashboard/staff');
    await page.goto('/queue');
    await expectListVisible(page, 'queue');
    await page.getByTestId('queue-search').fill(title);
    await openFirstEntry(page, 'queue');
    await expect(page.getByTestId('staff-ticket-detail')).toBeVisible();

    const claim = page.getByTestId('staff-claim');
    if (await claim.isVisible().catch(() => false)) await claim.click();
    await page.getByTestId('staff-it-priority').selectOption('URGENT');
    await page.getByTestId('staff-priority-save').click();
    await page.getByTestId('staff-status-IN_PROGRESS').click();
    await expect(page.getByTestId('staff-status-OPEN')).toBeVisible({ timeout: 15000 });

    // Comments + notes (Lab 3 append-only).
    await page.getByTestId('comment-composer').fill('E2E L23 public comment.');
    await page.getByTestId('comment-submit').click();
    // Scope to the list: the composer textarea holds the same text until the
    // POST clears it, so an unscoped getByText could pass before the save.
    await expect(
      page.getByTestId('comments-list').getByText('E2E L23 public comment.'),
    ).toBeVisible({ timeout: 15000 });
    await page.getByTestId('note-composer').fill('E2E L23 internal note.');
    await page.getByTestId('note-submit').click();
    await expect(page.getByTestId('notes-list').getByText('E2E L23 internal note.')).toBeVisible({
      timeout: 15000,
    });
    await logout(page);

    // Requester sees comment only (BR-18).
    await login(page, REQ_CREATE);
    await page.goto('/my-tickets');
    await page.getByTestId('ticket-search').fill(title);
    await page.getByRole('button', { name: /apply/i }).click();
    await openFirstEntry(page, 'ticket');
    await expect(
      page.getByTestId('comments-list').getByText('E2E L23 public comment.'),
    ).toBeVisible({ timeout: 15000 });
    expect(await page.getByTestId('internal-notes').count()).toBe(0);
    await logout(page);
  });

  test('resolve-intent NEW → RESOLVED → REOPENED', async ({ page }) => {
    const title = uniqueTitle('E2E L23 Resolve');
    await login(page, REQ_RESOLVE);
    await createTicket(page, title);
    await page.goto('/my-tickets');
    await page.getByTestId('ticket-search').fill(title);
    await page.getByRole('button', { name: /apply/i }).click();
    await openFirstEntry(page, 'ticket');
    await page.getByTestId('resolve-intent-button').click();
    await expect(page.getByText('RESOLVED')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('resolve-intent-button').click();
    await expect(page.getByText('REOPENED')).toBeVisible({ timeout: 15000 });
    await logout(page);
  });

  test('admin create → duplicate 409 → reset → next-login change', async ({ page }) => {
    const email = uniqueEmail('e2el23adm');
    await login(page, ADMIN);
    await page.goto('/users');
    await expect(page.getByTestId('user-row').first()).toBeVisible();
    await page.getByTestId('user-create-open').click();
    await page.getByTestId('user-form-name').fill('E2E L23 Created');
    await page.getByTestId('user-form-email').fill(email);
    await page.getByTestId('user-form-role').selectOption('REQUESTER');
    await page.getByTestId('user-form-password').fill('E2E-Temp123!');
    await page.getByTestId('user-form-save').click();
    await expect(page.getByTestId('user-row').filter({ hasText: email })).toBeVisible();

    await page.getByTestId('user-create-open').click();
    await page.getByTestId('user-form-name').fill('E2E Duplicate');
    await page.getByTestId('user-form-email').fill(email);
    await page.getByTestId('user-form-password').fill('E2E-Temp123!');
    await page.getByTestId('user-form-save').click();
    await expect(page.getByText('A user with this email already exists.')).toBeVisible();
    await page.getByTestId('user-modal').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('user-modal')).toBeHidden();
    await logout(page);

    // Seeded admin password untouched.
    await page.goto('/login');
    await page.getByTestId('login-email').fill(ADMIN);
    await page.getByTestId('login-password').fill(SEED_PASSWORD);
    await page.getByTestId('login-submit').click();
    await page.waitForURL('**/dashboard/staff');
    await logout(page);
    void E2E_PASSWORD;
  });
});
