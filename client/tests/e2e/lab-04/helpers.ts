import { expect, type Locator, type Page } from '@playwright/test';

// Lab 4 E2E helpers (tests.md §5, AC-34–AC-59). Re-uses the battle-tested
// Lab 3 login/logout/ticket primitives so Lab 4 specs stay focused on
// dashboards + Actions Taken. Each spec uses dedicated seeded accounts so
// password rotation never crosses specs.
export {
  login,
  logout,
  createTicket,
  openFirstEntry,
  expectListVisible,
  uniqueTitle,
  SEED_PASSWORD,
  E2E_PASSWORD,
} from '../lab-03/helpers';

import { login as lab3Login } from '../lab-03/helpers';

export const REQUESTER_A = 'anong.srisuk@toktikit.com';
export const REQUESTER_ZERO = 'busaba.jitdee@toktikit.com';
export const STAFF = 'somchai.jaidee@toktikit.com';
export const ADMIN = 'admin@toktikit.com';
export const STAFF_PASSWORD = 'TokTickDemo123!';

/** Staff login without the requester password-rotation dance (no forced change). */
export async function loginStaff(page: Page, email: string = STAFF): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(STAFF_PASSWORD);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/dashboard/staff', { timeout: 20000 });
}

/** Requester login via the shared rotation-tolerant helper. */
export async function loginRequester(page: Page, email: string): Promise<void> {
  await lab3Login(page, email);
}

/**
 * Click a control without losing the race against the browser's own
 * mid-gesture scrolling. Two failure modes were observed on narrow viewports:
 *  - a control flush against the edge of a scrollable ancestor slides out from
 *    under the pointer when focusing it scrolls that ancestor, so mouseup
 *    lands on the container and no click is dispatched;
 *  - on touch-emulating projects (tablet/mobile) a synthesized mouse press can
 *    still be dropped when the page scrolls mid-press.
 * Centering the control on both axes removes the first, and using the device's
 * real input (a tap) removes the second.
 */
export async function clickStable(locator: Locator): Promise<void> {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  const touch = await locator
    .page()
    .evaluate(() => 'ontouchstart' in window || navigator.maxTouchPoints > 0);
  if (touch) await locator.tap();
  else await locator.click();
}

/** Open a dashboard card and assert the drill-down list matches the card count. */
export async function expectDrillDownMatchesCard(
  page: Page,
  cardTestId: string,
  listKind: 'ticket' | 'queue',
): Promise<void> {
  const countText = await page.getByTestId(`${cardTestId}-count`).innerText();
  const count = Number.parseInt(countText.trim(), 10);
  expect(Number.isSafeInteger(count)).toBe(true);
  await page.getByTestId(cardTestId).click();
  // Drill-down lands on a filtered list with a visible chip.
  await expect(
    page.getByTestId(listKind === 'ticket' ? 'tickets-drilldown-filters' : 'queue-drilldown-filters'),
  ).toBeVisible({ timeout: 15000 });
  const summary = page.getByTestId(
    listKind === 'ticket' ? 'pagination-summary' : 'queue-pagination-summary',
  );
  await expect(summary).toContainText(`of ${count} tickets`);
}

/** Fill and submit the Actions Taken create form as staff. */
export async function recordActionViaUI(
  page: Page,
  description: string,
  result: string,
  followUpNote?: string,
): Promise<void> {
  await expect(page.getByTestId('action-create-form')).toBeVisible();
  await page.getByTestId('action-description').fill(description);
  await page.getByTestId('action-result').fill(result);
  if (followUpNote !== undefined) {
    await page.getByTestId('action-followup').check();
    await page.getByTestId('action-followup-note').fill(followUpNote);
  }
  await clickStable(page.getByTestId('action-submit'));
  // NB: getByText(description) also matches the still-filled create textarea,
  // so it can pass before the POST lands — wait for the list entry itself.
  await expect(
    page
      .locator('[data-testid^="action-row-"]:visible, [data-testid^="action-card-"]:visible')
      .filter({ hasText: description })
      .first(),
  ).toBeVisible({ timeout: 15000 });
}

/** Collect console errors during a callback for the AC-55 hygiene sweep. */
export async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}
