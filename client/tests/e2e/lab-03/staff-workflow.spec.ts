import { test, expect } from '@playwright/test';
import { login, logout, createTicket, openFirstEntry, expectListVisible, uniqueTitle } from './helpers';

// Lab 3 E2E: IT staff workflow (AC-14–AC-19, AC-22/23, tests.md rows 63-64).
// Requester side uses sirichai.thongdee; staff side uses somchai.jaidee
// (seeded IT Staff, no forced password change).
const REQUESTER = 'sirichai.thongdee@toktikit.com';
const STAFF = 'somchai.jaidee@toktikit.com';
const STAFF_PASSWORD = 'TokTickDemo123!';

test.describe('staff workflow', () => {
  test('claim → IT priority → status → comment + note, requester sees comment only', async ({ page }) => {
    const title = uniqueTitle('E2E Staff Flow');

    // 1. Requester files a fresh (unassigned, NEW) ticket.
    await login(page, REQUESTER);
    await createTicket(page, title);
    await logout(page);

    // 2. Staff opens the queue and finds it.
    await page.goto('/login');
    await page.getByTestId('login-email').fill(STAFF);
    await page.getByTestId('login-password').fill(STAFF_PASSWORD);
    await page.getByTestId('login-submit').click();
    await page.waitForURL('**/queue');
    await expectListVisible(page, 'queue');
    await page.screenshot({ path: `../docs/lab-03/images/e2e-queue-${test.info().project.name}.png` });

    await page.getByTestId('queue-search').fill(title);
    await openFirstEntry(page, 'queue');
    await expect(page.getByTestId('staff-ticket-detail')).toBeVisible();

    // 3. Claim the unassigned ticket (AC-15).
    await page.getByTestId('staff-claim').click();
    await expect(page.getByTestId('staff-owner')).toContainText('Somchai Jaidee');

    // 4. IT priority without touching requested priority (AC-17).
    await page.getByTestId('staff-it-priority').selectOption('URGENT');
    await page.getByTestId('staff-priority-save').click();
    await expect(page.getByTestId('staff-ticket-detail').locator('strong', { hasText: 'URGENT' })).toBeVisible();

    // 5. Legal status edge NEW → IN_PROGRESS (AC-18).
    await page.getByTestId('staff-status-IN_PROGRESS').click();
    await expect(page.getByTestId('staff-status-OPEN')).toBeVisible();
    await page.screenshot({ path: `../docs/lab-03/images/e2e-staff-detail-${test.info().project.name}.png` });

    // 6. Public comment + internal note (AC-22/23).
    await page.getByTestId('comment-composer').fill('E2E public comment: looking into it.');
    await page.getByTestId('comment-submit').click();
    await expect(page.getByText('E2E public comment: looking into it.')).toBeVisible();
    await page.getByTestId('note-composer').fill('E2E internal note: vpn logs.');
    await page.getByTestId('note-submit').click();
    await expect(page.getByText('E2E internal note: vpn logs.')).toBeVisible();

    // 7. Requester sees the comment but never the note (AC-22/23, BR-18).
    await logout(page);
    await login(page, REQUESTER);
    await page.goto('/my-tickets');
    await page.getByTestId('ticket-search').fill(title);
    await page.getByRole('button', { name: /apply/i }).click();
    await openFirstEntry(page, 'ticket');
    await expect(page.getByText('E2E public comment: looking into it.')).toBeVisible();
    expect(await page.getByTestId('internal-notes').count()).toBe(0);
    expect(await page.getByText('E2E internal note: vpn logs.').count()).toBe(0);
  });
});
