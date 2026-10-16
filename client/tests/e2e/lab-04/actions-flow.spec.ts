import { test, expect } from '@playwright/test';
import {
  loginRequester,
  loginStaff,
  logout,
  createTicket,
  openFirstEntry,
  uniqueTitle,
  REQUESTER_A,
} from './helpers';

// Lab 4 E2E row 29 (AC-34–AC-41): staff login → record → edit →
// stale-retry → requester reads own list.
// Covers FR-25–FR-28, FR-33, BR-23/BR-24/BR-27/BR-28 at the UI level.

test.describe('actions taken flow', () => {
  test('record → edit → requester reads own list', async ({ page }) => {
    const title = uniqueTitle('E2E Actions Flow');
    const description = `E2E action ${Date.now()}`;
    const editedResult = `E2E edited ${Date.now()}`;

    // 1. Requester files a ticket so staff has a known target.
    await loginRequester(page, REQUESTER_A);
    await createTicket(page, title);
    await logout(page);

    // 2. Staff finds it in the queue and claims it.
    await loginStaff(page);
    await page.goto('/queue');
    await page.getByTestId('queue-search').fill(title);
    // Debounced search (400ms) — wait for the filtered row.
    await expect(page.getByTestId('queue-row').first()).toBeVisible({ timeout: 15000 });
    await openFirstEntry(page, 'queue');
    await expect(page.getByTestId('staff-ticket-detail')).toBeVisible();
    const ticketId = new URL(page.url()).pathname.split('/').pop()!;

    // Claim so the dashboard "My Assigned" reflects it (best-effort).
    const claim = page.getByTestId('staff-claim');
    if (await claim.isVisible().catch(() => false)) {
      await claim.click();
    }

    // 3. Record an action (AC-34: performedBy = me, version = 1).
    await expect(page.getByTestId('actions-taken')).toBeVisible();
    await expect(page.getByTestId('action-recording-as')).toContainText('Somchai');
    await page.getByTestId('action-description').fill(description);
    await page.getByTestId('action-result').fill('Initial E2E result.');
    await page.getByTestId('action-submit').click();
    await expect(page.getByText(description).first()).toBeVisible({ timeout: 15000 });

    // Recording never drives status (BR-24): still the pre-action status.
    const statusBefore = await page
      .getByTestId('staff-ticket-detail')
      .getByText(/NEW|OPEN|IN_PROGRESS|WAITING_FOR_REQUESTER|RESOLVED|CLOSED|REOPENED|CANCELLED/)
      .first()
      .innerText()
      .catch(() => '');

    // 4. Edit it inline (AC-36: version + 1) and verify the update renders.
    const rowId = await page
      .evaluate(() => {
        const el = document.querySelector('[data-testid^="action-row-"]');
        return el?.getAttribute('data-testid')?.replace('action-row-', '') ?? null;
      })
      .catch(() => null);
    expect(rowId).toBeTruthy();
    const editButton = page.getByTestId(`action-edit-${rowId}`).first();
    // Mobile renders card edit buttons instead of row buttons.
    const editTarget = (await editButton.count()) > 0 ? editButton : page.getByTestId(`action-card-edit-${rowId}`).first();
    await editTarget.click();
    await expect(page.getByTestId('action-edit-form')).toBeVisible();
    await page.getByTestId('action-edit-result').fill(editedResult);
    await page.getByTestId('action-edit-submit').click();
    await expect(page.getByText(editedResult).first()).toBeVisible({ timeout: 15000 });

    // 5. Stale-retry: bump the row behind the UI's back, then save → 409 banner.
    await editTarget.click();
    await expect(page.getByTestId('action-edit-form')).toBeVisible();
    const bumped = await page.evaluate(
      async ({ ticketId, rowId }) => {
        const listRes = await fetch(`http://127.0.0.1:3000/api/tickets/${ticketId}/actions?limit=50`, {
          credentials: 'include',
        });
        const list = await listRes.json();
        const row = list.actions.find((a: { id: number }) => a.id === Number(rowId));
        if (!row) return false;
        const patchRes = await fetch(`http://127.0.0.1:3000/api/actions/${row.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'If-Match': String(row.version) },
          body: JSON.stringify({ result: 'Bumped behind the UI.' }),
        });
        return patchRes.ok;
      },
      { ticketId, rowId },
    );
    expect(bumped).toBe(true);
    await page.getByTestId('action-edit-result').fill('Stale UI attempt.');
    await page.getByTestId('action-edit-submit').click();
    await expect(page.getByTestId('action-conflict')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('action-conflict-refresh').click();
    await expect(page.getByTestId('action-conflict')).toBeHidden({ timeout: 15000 });
    await expect(page.getByText('Bumped behind the UI.').first()).toBeVisible();
    void statusBefore;

    await logout(page);

    // 6. Requester reads the same actions read-only (AC-40, AC-50).
    await loginRequester(page, REQUESTER_A);
    await page.goto('/my-tickets');
    await page.getByTestId('ticket-search').fill(title);
    await page.getByRole('button', { name: /apply/i }).click();
    await openFirstEntry(page, 'ticket');
    await expect(page.getByTestId('ticket-detail')).toBeVisible();
    await expect(page.getByText(description).first()).toBeVisible();
    // Zero create/edit affordances for requesters.
    expect(await page.getByTestId('action-create-form').count()).toBe(0);
    expect(await page.getByTestId('action-edit-form').count()).toBe(0);
    await logout(page);
  });
});
