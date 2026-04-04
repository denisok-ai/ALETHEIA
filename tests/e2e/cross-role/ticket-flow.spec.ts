/**
 * E2E: сквозной сценарий — студент создаёт тикет, менеджер отвечает, студент видит ответ.
 */
import { test, expect } from '../fixtures';

const PASSWORD = 'Test123!';
const TICKET_SUBJECT = `E2E тест ${Date.now()}`;
const TICKET_MESSAGE = 'Сообщение из E2E-теста.';
const MANAGER_REPLY = 'Ответ менеджера из E2E-теста.';

test('студент создаёт тикет → менеджер отвечает → студент видит ответ', async ({ page, loginAs }) => {
  await loginAs('student4@test.local', PASSWORD);
  await page.goto('/portal/student/support');
  await page.getByLabel(/тема/i).fill(TICKET_SUBJECT);
  await page.getByLabel(/сообщение/i).fill(TICKET_MESSAGE);
  await page.getByRole('button', { name: /отправить обращение/i }).click();
  await expect(page.getByText(TICKET_SUBJECT)).toBeVisible({ timeout: 10000 });

  await loginAs('manager@test.local', PASSWORD);
  await page.goto('/portal/manager/tickets');
  // Тема и колонка «Открыть» дают два линка с пересечением по имени — берём ссылку с точным текстом темы
  const ticketSubjectLink = page.getByRole('link', { name: TICKET_SUBJECT, exact: true }).first();
  await expect(ticketSubjectLink).toBeVisible({ timeout: 10000 });
  await ticketSubjectLink.click();
  await expect(page).toHaveURL(/\/portal\/manager\/tickets\/.+/);
  const replyInput = page.getByRole('textbox', { name: /ответ|введите сообщение/i });
  await expect(replyInput).toBeVisible({ timeout: 5000 });
  await replyInput.fill(MANAGER_REPLY);
  await page.getByRole('button', { name: /^отправить$/i }).click();
  await expect(page.getByText(/сообщение отправлено/i)).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(MANAGER_REPLY).first()).toBeVisible({ timeout: 5000 });

  await loginAs('student4@test.local', PASSWORD);
  await page.goto('/portal/student/support');
  await page.getByRole('link', { name: TICKET_SUBJECT }).first().click();
  await expect(page).toHaveURL(/\/portal\/student\/support\/.+/);
  await expect(page.getByRole('heading', { name: /переписка/i })).toBeVisible({ timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(MANAGER_REPLY).first()).toBeVisible({ timeout: 15000 });
});
