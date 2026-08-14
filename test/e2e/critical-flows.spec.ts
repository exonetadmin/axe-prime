import { test, expect } from '@playwright/test';

test.describe('AXE PRIME Critical Flows', () => {
  test.describe('Landing Page', () => {
    test('should display hero section with correct content', async ({ page }) => {
      await page.goto('/');
      
      // Check main headline
      await expect(page.getByRole('heading', { name: /Patrimônio em outra escala/i }))
        .toBeVisible();
      
      // Check CTA buttons
      await expect(page.getByRole('link', { name: /Entrar para a estrutura/i }))
        .toBeVisible();
      await expect(page.getByRole('link', { name: /Conhecer a jornada/i }))
        .toBeVisible();
    });

    test('should navigate to simulator', async ({ page }) => {
      await page.goto('/');
      
      await page.getByRole('link', { name: /Simulador de investimentos/i }).click();
      
      await expect(page).toHaveURL('/simulador');
      await expect(page.getByRole('heading', { name: /Simulador/i }))
        .toBeVisible();
    });

    test('should show plan comparison on simulator', async ({ page }) => {
      await page.goto('/simulador');
      
      await expect(page.getByText('Start')).toBeVisible();
      await expect(page.getByText('Prime')).toBeVisible();
    });
  });

  test.describe('Authentication', () => {
    test('should show login form', async ({ page }) => {
      await page.goto('/auth');
      
      await expect(page.getByLabel(/E-mail/i)).toBeVisible();
      await expect(page.getByLabel(/Senha/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Entrar/i })).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('/auth');
      
      await page.getByRole('button', { name: /Entrar/i }).click();
      
      // HTML5 validation should prevent submission
      await expect(page.getByLabel(/E-mail/i)).toHaveAttribute('required', '');
    });

    test('should navigate to registration', async ({ page }) => {
      await page.goto('/auth');
      
      await page.getByRole('button', { name: /Cadastrar/i }).click();
      
      await expect(page.getByLabel(/Nome completo/i)).toBeVisible();
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated user from portal', async ({ page }) => {
      await page.goto('/portal');
      
      await expect(page).toHaveURL('/auth');
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');
      
      const h1 = await page.locator('h1').count();
      expect(h1).toBe(1); // Only one h1 per page
    });

    test('should have accessible navigation', async ({ page }) => {
      await page.goto('/');
      
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();
    });
  });
});
