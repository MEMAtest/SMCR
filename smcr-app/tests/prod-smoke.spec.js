const { test, expect } = require('@playwright/test');

test('home and builder pages load', async ({ page }) => {
  await page.goto('https://smcr-app.vercel.app/');
  const launchBuilderLink = page.getByRole('link', { name: 'Launch SMCR Builder' }).first();
  await expect(launchBuilderLink).toBeVisible();

  await launchBuilderLink.click();
  await expect(page.getByText('Back to overview')).toBeVisible();
  await expect(page).toHaveURL(/\/builder/);
});

test('sign-in flow shows confirmation after submit', async ({ page }) => {
  await page.goto('https://smcr-app.vercel.app/auth/signin');
  await expect(page.getByRole('heading', { name: 'SMCR Assistant' })).toBeVisible();

  await page.getByLabel('Email address').fill('ademola@memaconsultants.com');
  await page.getByRole('button', { name: /Send magic link/i }).click();

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
});
