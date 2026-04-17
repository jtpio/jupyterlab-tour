import { expect, test } from '@jupyterlab/galata';
import { advanceTour } from './_testutils';

test('should run the welcome tour', async ({ page }) => {
  await page.getByRole('button', { name: 'Start now' }).click();
  await advanceTour(page, 8);
  await expect
    .soft(page.locator('.react-joyride__tooltip h1'))
    .toHaveText('Command Palette');
  await page.getByLabel('Done').click();
});

test('should run the notebook tour', async ({ page }) => {
  await page.getByRole('menuitem', { name: 'File' }).click();
  await page.getByText('New', { exact: true }).click();
  await page.locator('#jp-mainmenu-file-new').getByText('Notebook').click();
  await page.locator('.jp-Dialog').waitFor();
  const kernelSelector = page.getByRole('button', { name: 'Select Kernel' });
  if ((await kernelSelector.count()) > 0) {
    await kernelSelector.click();
  } else {
    await page.getByRole('button', { name: 'Select', exact: true }).click();
  }

  const nth = (await page.getByRole('alert').count()) === 2 ? 1 : 0;
  await page.getByRole('button', { name: 'Start now' }).nth(nth).click();
  await advanceTour(page, 9);
  await expect
    .soft(page.locator('.react-joyride__tooltip p'))
    .toHaveText('Metadata (like tags) can be added to cells through this tab.');
  await page.getByLabel('Done').click();
});
