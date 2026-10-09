import { test, expect, type Page } from '@playwright/test';

const STORY = 'A surprise farewell for my sister before she moves to Pune';

async function freshFlow(page: Page) {
  await page.goto('/book/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test.describe('"Something else" — writing your own occasion', () => {
  test('is offered alongside the six set occasions', async ({ page }) => {
    await freshFlow(page);
    await expect(page.locator('[data-exp-pick]')).toHaveCount(7);
    await expect(page.locator('[data-exp-pick="other"]')).toContainText('Something else');
  });

  test('opens a box to describe the night instead of skipping ahead', async ({ page }) => {
    await freshFlow(page);
    await page.locator('[data-exp-pick="other"]').click();

    await expect(page.locator('.other-box')).toBeVisible();
    await expect(page.locator('#bkTitle'), 'stays on the occasion step').toContainText('What are you celebrating');
    await expect(page.locator('#bkCustom')).toBeFocused();
    await expect(page.locator('[data-exp-pick="other"]')).toHaveAttribute('aria-expanded', 'true');
  });

  test('will not continue until something is written', async ({ page }) => {
    await freshFlow(page);
    await page.locator('[data-exp-pick="other"]').click();
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('.bk-flash')).toContainText('what you are planning');

    await page.fill('#bkCustom', STORY);
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('#bkTitle')).toContainText("who's coming");
  });

  test('their own words follow the booking all the way through', async ({ page }) => {
    await freshFlow(page);
    await page.locator('[data-exp-pick="other"]').click();
    await page.fill('#bkCustom', STORY);
    await page.locator('[data-bk-next]').click();

    await expect(page.locator('#bkTotal')).toContainText(STORY);

    await page.locator('[data-date-pick]').first().click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s1"]').click();
    await page.locator('[data-pkg-pick="room"]').click();
    await expect(page.locator('.bk-sum-row').first()).toContainText(STORY);

    await page.locator('[data-bk-next]').click();
    await page.fill('#bName', 'Akash');
    await page.fill('#bPhone', '7999656039');
    await page.locator('[data-bk-next]').click();

    await expect(page.locator('.bk-done')).toContainText(STORY);
    const saved = await page.evaluate(() => localStorage.getItem('ys-requests'));
    expect(saved).toContain('Pune');
  });

  test('what was written survives a reload', async ({ page }) => {
    await freshFlow(page);
    await page.locator('[data-exp-pick="other"]').click();
    await page.fill('#bkCustom', STORY);
    await page.waitForTimeout(150);
    await page.reload();
    await expect(page.locator('#bkCustom')).toHaveValue(STORY);
  });

  test('switching back to a set occasion moves on as before', async ({ page }) => {
    await freshFlow(page);
    await page.locator('[data-exp-pick="other"]').click();
    await expect(page.locator('.other-box')).toBeVisible();
    await page.locator('[data-exp-pick="karaoke"]').click();
    await expect(page.locator('#bkTitle')).toContainText("who's coming");
    await expect(page.locator('#bkTotal')).toContainText('Karaoke');
  });

  test('the hero ticket reveals a field and carries it into the flow', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('#qCustomField')).toBeHidden();
    await page.selectOption('#qExperience', 'other');
    await expect(page.locator('#qCustomField')).toBeVisible();
    await expect(page.locator('#qCustom')).toBeFocused();

    await page.fill('#qCustom', 'A farewell party');
    await page.locator('#quickStart button[type=submit]').click();
    await expect(page.locator('#bkTotal')).toContainText('A farewell party');
  });

  test('the pre-book form asks for details and requires them', async ({ page }) => {
    await page.addInitScript(() => { window.open = () => null; });
    await page.goto('/prebook/');

    await expect(page.locator('#pCustomField')).toBeHidden();
    await page.selectOption('#pExperience', 'other');
    await expect(page.locator('#pCustomField')).toBeVisible();

    await page.fill('#pName', 'Akash');
    await page.fill('#pPhone', '7999656039');
    await page.fill('#pDate', '2026-12-01');
    await page.locator('#prebookForm button[type=submit]').click();
    await expect(page.locator('#prebookForm .form-note')).toContainText("what you're planning");

    await page.fill('#pCustom', 'A farewell party');
    await page.locator('#prebookForm button[type=submit]').click();
    await expect(page.locator('#prebookForm .form-note')).toContainText('Thanks');
  });

  test('choosing a set occasion does not demand details', async ({ page }) => {
    await page.addInitScript(() => { window.open = () => null; });
    await page.goto('/prebook/');
    await page.selectOption('#pExperience', 'Karaoke');
    await expect(page.locator('#pCustomField')).toBeHidden();

    await page.fill('#pName', 'Akash');
    await page.fill('#pPhone', '7999656039');
    await page.fill('#pDate', '2026-12-01');
    await page.locator('#prebookForm button[type=submit]').click();
    await expect(page.locator('#prebookForm .form-note')).toContainText('Thanks');
  });
});
