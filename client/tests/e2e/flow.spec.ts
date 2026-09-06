import { test, expect, type Page } from '@playwright/test';

const CURRENT_YEAR = new Date().getFullYear();

function uniqueTitle(): string {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `E2E QA Flow ${ts}`;
}

async function selectRequester(page: Page): Promise<void> {
  await page.goto('/select-requester');
  const select = page.locator('#requester-select');
  await expect(select).toBeVisible();
  const count = await select.locator('option').count();
  expect(count).toBeGreaterThan(1);
  await select.selectOption({ index: 1 });
  await page.getByRole('button', { name: /Continue/i }).click();
  await page.waitForURL('**/');
}

async function createTicket(page: Page, title: string): Promise<string> {
  await page.goto('/create-ticket');
  await expect(page.getByTestId('create-ticket-form')).toBeVisible();

  await page.getByTestId('field-title').fill(title);
  await page.getByTestId('field-category').selectOption({ index: 1 });
  await page.getByTestId('field-system').selectOption({ index: 1 });
  await page.getByTestId('field-priority').selectOption('LOW');
  await page.getByTestId('field-description').fill(`Playwright end-to-end regression ticket created on ${new Date().toUTCString()}.`);

  await page.getByRole('button', { name: 'Submit Ticket' }).click();

  await expect(page.getByTestId('create-ticket-success')).toBeVisible();
  const ticketNo = (await page.getByTestId('ticket-no').innerText()).trim();
  expect(ticketNo).toMatch(new RegExp(`^TK-${CURRENT_YEAR}`));
  return ticketNo;
}

async function openMyTickets(page: Page) {
  const desktopLink = page.getByRole('navigation').getByRole('link', { name: 'My Tickets' });
  if (await desktopLink.isVisible()) {
    await desktopLink.click();
  } else {
    await page.getByRole('button', { name: /Open navigation menu/i }).click();
    await page.getByRole('link', { name: 'My Tickets' }).click();
  }
  await page.waitForURL('**/my-tickets');
  await expect(page.getByTestId('ticket-search')).toBeVisible();
}

async function findTicketCell(page: Page, title: string) {
  const row = page.getByTestId('ticket-row').filter({ hasText: title }).first();
  const card = page.getByTestId('ticket-card').filter({ hasText: title }).first();
  try {
    await row.waitFor({ state: 'visible', timeout: 5000 });
    return row;
  } catch {
    await card.waitFor({ state: 'visible', timeout: 5000 });
    return card;
  }
}

test('full flow: select requester -> create ticket -> find in list (AC-18)', async ({ page }) => {
  await selectRequester(page);
  const title = uniqueTitle();
  const ticketNo = await createTicket(page, title);

  await openMyTickets(page);
  await page.getByTestId('ticket-search').fill(title);
  await page.getByTestId('ticket-search').press('Enter');

  const cell = await findTicketCell(page, title);
  await expect(cell).toContainText(ticketNo);
  await cell.click();
  await page.waitForURL('**/tickets/**');
  await expect(page.getByTestId('ticket-detail')).toBeVisible();
  await expect(page.getByTestId('ticket-title')).toHaveText(title);
  await expect(page.getByTestId('ticket-ticket-no')).toHaveText(ticketNo);
});