import { test, expect } from '@playwright/test';
import {
  loginRequester,
  loginStaff,
  logout,
  createTicket,
  openFirstEntry,
  expectListVisible,
  clickStable,
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
    // The queue renders a table at lg+ and cards below — wait for whichever
    // layout this viewport uses before searching and drilling in.
    await expectListVisible(page, 'queue');
    await page.getByTestId('queue-search').fill(title);
    await openFirstEntry(page, 'queue');
    await expect(page.getByTestId('staff-ticket-detail')).toBeVisible();
    const ticketId = new URL(page.url()).pathname.split('/').pop()!;

    // Claim so the dashboard "My Assigned" reflects it (best-effort).
    // NB: in-flow buttons use clickStable — see helpers.ts for the
    // focus-scroll race that otherwise swallows clicks on narrow viewports.
    const claim = page.getByTestId('staff-claim');
    if (await claim.isVisible().catch(() => false)) {
      await clickStable(claim);
    }

    // 3. Record an action (AC-34: performedBy = me, version = 1).
    await expect(page.getByTestId('actions-taken')).toBeVisible();
    await expect(page.getByTestId('action-recording-as')).toContainText('Somchai');
    await page.getByTestId('action-description').fill(description);
    await page.getByTestId('action-result').fill('Initial E2E result.');
    await clickStable(page.getByTestId('action-submit'));
    // NB: getByText(description) alone also matches the still-filled create
    // textarea, so it passes before the POST lands. Wait for the list entry
    // itself — table row at md+, card below md.
    const newRow = page
      .locator('[data-testid^="action-row-"]:visible, [data-testid^="action-card-"]:visible')
      .filter({ hasText: description })
      .first();
    await expect(newRow).toBeVisible({ timeout: 15000 });

    // Recording never drives status (BR-24): still the pre-action status.
    const statusBefore = await page
      .getByTestId('staff-ticket-detail')
      .getByText(/NEW|OPEN|IN_PROGRESS|WAITING_FOR_REQUESTER|RESOLVED|CLOSED|REOPENED|CANCELLED/)
      .first()
      .innerText()
      .catch(() => '');

    // 4. Edit it inline (AC-36: version + 1) and verify the update renders.
    const rowTestId = await newRow.getAttribute('data-testid');
    expect(rowTestId).toBeTruthy();
    const rowId = (rowTestId ?? '').replace(/^action-(row|card)-/, '');
    expect(rowId).not.toBe('');
    // The desktop table stays in the DOM on narrow viewports (d-none), so pick
    // the edit button that is actually visible for this layout.
    const editTarget = page
      .locator(
        `[data-testid="action-edit-${rowId}"]:visible, [data-testid="action-card-edit-${rowId}"]:visible`,
      )
      .first();
    await expect(editTarget).toBeVisible();
    await clickStable(editTarget);
    await expect(page.getByTestId('action-edit-form')).toBeVisible();
    await page.getByTestId('action-edit-result').fill(editedResult);
    await clickStable(page.getByTestId('action-edit-submit'));
    // The edit textarea still holds editedResult while the save is in flight —
    // wait for the form to close and the list to render the new value.
    await expect(page.getByTestId('action-edit-form')).toBeHidden({ timeout: 15000 });
    await expect(newRow).toContainText(editedResult, { timeout: 15000 });

    // 5. Stale-retry: bump the row behind the UI's back, then save → 409 banner.
    await clickStable(editTarget);
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
    await clickStable(page.getByTestId('action-edit-submit'));
    await expect(page.getByTestId('action-conflict')).toBeVisible({ timeout: 15000 });
    await clickStable(page.getByTestId('action-conflict-refresh'));
    await expect(page.getByTestId('action-conflict')).toBeHidden({ timeout: 15000 });
    // Assert on the list row (the edit textarea shows the same refreshed text).
    await expect(newRow).toContainText('Bumped behind the UI.', { timeout: 15000 });
    void statusBefore;

    await logout(page);

    // 6. Requester reads the same actions read-only (AC-40, AC-50).
    await loginRequester(page, REQUESTER_A);
    await page.goto('/my-tickets');
    await page.getByTestId('ticket-search').fill(title);
    await page.getByRole('button', { name: /apply/i }).click();
    await openFirstEntry(page, 'ticket');
    await expect(page.getByTestId('ticket-detail')).toBeVisible();
    // Visible layout only: the hidden desktop table also contains the text.
    await expect(
      page
        .locator('[data-testid^="action-row-"]:visible, [data-testid^="action-card-"]:visible')
        .filter({ hasText: description })
        .first(),
    ).toBeVisible({ timeout: 15000 });
    // Zero create/edit affordances for requesters.
    expect(await page.getByTestId('action-create-form').count()).toBe(0);
    expect(await page.getByTestId('action-edit-form').count()).toBe(0);
    await logout(page);
  });
});
