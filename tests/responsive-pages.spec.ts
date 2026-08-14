import { test, expect } from '@playwright/test';

test.describe('Responsive Pages', () => {
  test('Home page should have correct meta and render properly', async ({ page }) => {
    await page.goto('/');
    
    // Check Title
    await expect(page).toHaveTitle(/AXE PRIME/i);
    
    // Check Hero section
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/Uma estrutura pensada para transformar capital em movimento/i).first()).toBeVisible();
    
    // Check Manifesto section
    await expect(page.getByRole('heading', { name: /Capital/i }).first()).toBeVisible();
    
    // Check Benefícios section
    await expect(page.getByRole('heading', { name: /Liquidez/i }).first()).toBeVisible();

    // Check Planos (Pricing)
    await expect(page.getByRole('heading', { name: /Duas entradas/i }).first()).toBeVisible();
  });

  test('Auth page should render properly', async ({ page }) => {
    await page.goto('/auth');
    
    // Check specific text on auth page
    await expect(page.getByRole('heading', { name: /Acesse sua area exclusiva/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    
    // Check link to return to home
    const backLink = page.getByRole('link', { name: /Voltar para a landing/i });
    await expect(backLink).toBeVisible();
  });
});
