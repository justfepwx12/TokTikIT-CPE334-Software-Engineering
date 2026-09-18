import { test, expect } from '@playwright/test';
import { login, logout, createTicket, openFirstEntry, uniqueTitle } from './helpers';

// Lab 3 E2E: requester resolve-intent lifecycle (AC-20, tests.md row 66).
// Uses weerapong.chaiyaporn (dedicated seeded requester).
const REQUESTER = 'weerapong.chaiyaporn@toktikit.com';

test.describe('requester resolve intent', () => {
  test('RESOLVED then REOPENED through the intent button', async ({ page }) => {
    const title = uniqueTitle('E2E Resolve Flow');
    await login(page, REQUESTER);
    await createTicket(page, title);

    // Open the fresh ticket from My Tickets (search matches title text).
    await page.goto('/my-tickets');
    await page.getByTestId('ticket-search').fill(title);
    await page.getByRole('button', { name: /apply/i }).click();
    await openFirstEntry(page, 'ticket');
    await expect(page.getByTestId('ticket-detail')).toBeVisible();
    await page.screenshot({ path: `../docs/lab-03/images/e2e-requester-detail-${test.info().project.name}.png` });

    // NEW → RESOLVED via "Problem Appears Resolved".
    await expect(page.getByTestId('resolve-intent-button')).toContainText('Problem Appears Resolved');
    await page.getByTestId('resolve-intent-button').click();
    await expect(page.getByText('RESOLVED')).toBeVisible();

    // RESOLVED → REOPENED via "Problem Still Occurs / Reopen".
    await expect(page.getByTestId('resolve-intent-button')).toContainText('Problem Still Occurs');
    await page.getByTestId('resolve-intent-button').click();
    await expect(page.getByText('REOPENED')).toBeVisible();

    await logout(page);
  });
});
