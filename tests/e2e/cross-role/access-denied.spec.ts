/**
 * RBAC: неподходящая роль → /portal/access-denied (middleware).
 */
import { test, expect } from '../fixtures';

const PASSWORD = 'Test123!';

test('студент: админка → страница «Доступ ограничен» (section=admin)', async ({ page, loginAs }) => {
  await loginAs('student4@test.local', PASSWORD);
  await page.goto('/portal/admin/dashboard');
  await expect(page).toHaveURL(/\/portal\/access-denied\?section=admin/);
  await expect(page.getByRole('heading', { name: 'Доступ ограничен' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Личный кабинет' })).toBeVisible();
});

test('студент: раздел менеджера → section=manager', async ({ page, loginAs }) => {
  await loginAs('student4@test.local', PASSWORD);
  await page.goto('/portal/manager/dashboard');
  await expect(page).toHaveURL(/\/portal\/access-denied\?section=manager/);
  await expect(page.getByRole('link', { name: 'Личный кабинет' })).toBeVisible();
});

test('менеджер: админка → section=admin', async ({ page, loginAs }) => {
  await loginAs('manager@test.local', PASSWORD);
  await page.goto('/portal/admin/courses');
  await expect(page).toHaveURL(/\/portal\/access-denied\?section=admin/);
  await expect(page.getByRole('link', { name: 'Кабинет менеджера' })).toBeVisible();
});
