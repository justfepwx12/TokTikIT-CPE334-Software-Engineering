import { test, expect } from '@playwright/test';
import {
  loginRequester,
  logout,
  openFirstEntry,
  REQUESTER_A,
  REQUESTER_ZERO,
} from './helpers';

// Lab 4 E2E row 30 (AC-42/AC-46): requester journey — summary → drill-down
// → detail → empty-state CTA. Proves own-only isolation (BR-25) and the
// FR-31 drill-down into GET /api/tickets.

test.describe('requester dashboard', () => {
  test('summary → drill-down → detail shows own tickets only', async ({ page }) => {
    await loginRequester(page, REQUESTER_A);
    await page.goto('/dashboard/requester');
    await expect(page.getByTestId('requester-dashboard-heading')).toBeVisible();

    // Own-only cards render; no staff-only metrics leak.
    for (const card of [
      'requester-card-open',
      'requester-card-waiting',
      'requester-card-resolved',
      'requester-card-closed',
      'requester-card-reopened',
      'requester-card-cancelled',
    ]) {
      await expect(page.getByTestId(card)).toBeVisible();
    }
    expect(await page.getByTestId('staff-card-unassigned').count()).toBe(0);

    // Zero metrics render 0, never blank (BR-29).
    const openCount = await page.getByTestId('requester-card-open-count').innerText();
    expect(openCount.trim()).toMatch(/^\d+$/);

    // Drill-down: card → filtered My Tickets with a visible chip.
    await page.getByTestId('requester-card-open').click();
    await expect(page.getByTestId('tickets-drilldown-filters')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('tickets-drilldown-status')).toContainText('NEW,OPEN,IN_PROGRESS');

    // Detail opens from the drilled-down list.
    await openFirstEntry(page, 'ticket');
    await expect(page.getByTestId('ticket-detail')).toBeVisible();
    await expect(page.getByTestId('actions-taken')).toBeVisible();
    await logout(page);
  });

  test('zero-ticket requester sees the empty state with a working CTA', async ({ page }) => {
    await loginRequester(page, REQUESTER_ZERO);
    await page.goto('/dashboard/requester');
    await expect(page.getByTestId('requester-dashboard-heading')).toBeVisible();

    // All-zero scope: every card reads 0 (BR-29).
    for (const card of [
      'requester-card-open-count',
      'requester-card-waiting-count',
      'requester-card-resolved-count',
      'requester-card-closed-count',
      'requester-card-reopened-count',
      'requester-card-cancelled-count',
    ]) {
      await expect(page.getByTestId(card)).toHaveText('0');
    }

    await expect(page.getByTestId('requester-dashboard-empty')).toContainText('You have no tickets yet.');
    await page.getByTestId('requester-empty-cta').click();
    await page.waitForURL('**/create-ticket');
    await expect(page.getByTestId('create-ticket-form')).toBeVisible();
    await logout(page);
  });
});
