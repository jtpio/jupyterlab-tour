import { expect, test } from '@jupyterlab/galata';
import { advanceTour } from './_testutils';
import type { Page } from 'playwright-core';

test.use({
  waitForApplication: async ({ baseURL }, use, testInfo) => {
    const waitIsReady = async (page: Page): Promise<void> => {
      await page.waitForSelector('#main-panel');
    };
    await use(waitIsReady);
  }
});

test('should run the welcome tour', async ({ page }) => {
  await page.getByRole('button', { name: 'Start now' }).click();
  await advanceTour(page, 6);

  await expect
    .soft(page.locator('.react-joyride__tooltip h1'))
    .toHaveText('Command Palette');
  await page.getByLabel('Done').click();
});

test('should run the notebook tour', async ({ page }) => {
  await page.getByRole('menuitem', { name: 'File' }).click();
  await page.getByLabel('file browser').getByText('New').click();
  await page.getByText('Python 3 (ipykernel)').click();

  const notebookPage = await page.waitForEvent('popup');
  await notebookPage.getByRole('button', { name: 'Start now' }).click();
  await advanceTour(notebookPage, 7);
  await expect
    .soft(notebookPage.locator('.react-joyride__tooltip p'))
    .toHaveText(/Its name and its status are displayed here\.$/);
  await notebookPage.getByLabel('Done').click();
});
