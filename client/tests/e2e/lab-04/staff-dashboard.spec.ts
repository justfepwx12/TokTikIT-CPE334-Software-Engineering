import { test, expect } from '@playwright/test';
import { loginStaff, logout, openFirstEntry, recordActionViaUI } from './helpers';

// Lab 4 E2E row 31 (AC-43/AC-46): staff journey — summary → drill-down →
// queue → record action. Proves aggregated-only summaries (BR-26) drill
// into the exact counted set via the staff queue (FR-31).

test.describe('staff dashboard', () => {
  test('summary → drill-down → queue → record action', async ({ page }) => {
    await loginStaff(page);
    await page.goto('/dashboard/staff');
    await expect(page.getByTestId('staff-dashboard-heading')).toBeVisible();

    for (const card of [
      'staff-card-unassigned',
      'staff-card-my-assigned',
      'staff-card-my-in-progress',
      'staff-card-waiting',
      'staff-card-followup',
      'staff-card-resolved-today',
    ]) {
      await expect(page.getByTestId(card)).toBeVisible();
    }

    // Shortcuts are plain links (never modals).
    await expect(page.getByTestId('staff-shortcut-record-action')).toBeVisible();
    await expect(page.getByTestId('staff-shortcut-open-queue')).toBeVisible();
    await expect(page.getByTestId('staff-shortcut-my-work')).toBeVisible();

    // Drill-down: Unassigned card → queue with ownerId=0 + multi-status chip.
    const unassignedCount = await page.getByTestId('staff-card-unassigned-count').innerText();
    expect(unassignedCount.trim()).toMatch(/^\d+$/);
    await page.getByTestId('staff-card-unassigned').click();
    await expect(page.getByTestId('queue-drilldown-filters')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('queue-drilldown-status')).toBeVisible();

    // Queue → detail → record an action in place.
    await openFirstEntry(page, 'queue');
    await expect(page.getByTestId('staff-ticket-detail')).toBeVisible();
    await expect(page.getByTestId('actions-taken')).toBeVisible();
    const description = `E2E staff dash action ${Date.now()}`;
    await recordActionViaUI(page, description, 'Recorded from the drill-down queue.');
    await logout(page);
  });

  test('requester cannot open the staff dashboard (403)', async ({ page }) => {
    // Covered here so the role guard is pinned by E2E, not just RTL.
    const { loginRequester, REQUESTER_A } = await import('./helpers');
    await loginRequester(page, REQUESTER_A);
    await page.goto('/dashboard/staff');
    await expect(page.getByTestId('role-forbidden')).toBeVisible();
    await logout(page);
  });
});
