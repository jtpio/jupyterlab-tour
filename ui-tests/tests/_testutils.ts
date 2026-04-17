import type { Page } from 'playwright-core';

/** Click next a number of times for a tour. */
export async function advanceTour(
  page: Page,
  steps: number,
  stop?: number,
  start: number = 1
) {
  stop = stop || steps - 1;
  for (let i = start; i <= stop; i++) {
    await page.getByRole('button', { name: `Next (Step ${i} of ${steps})` }).click();
  }
}
