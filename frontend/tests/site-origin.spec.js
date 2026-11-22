import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { retiredSiteDestination } from '../src/services/site.js';

test('retired showcase links preserve their page and query on the main site', () => {
  expect(retiredSiteDestination('https://paperloom-frontend.onrender.com/')).toBe('https://paperloom.onrender.com/');
  expect(retiredSiteDestination('https://paperloom-frontend.onrender.com/papers/7?format=citation#BibTeX'))
    .toBe('https://paperloom.onrender.com/papers/7?format=citation#BibTeX');
});

test('the main site, local development and unrelated hosts keep their own origin', () => {
  for (const href of [
    'https://paperloom.onrender.com/browse',
    'http://127.0.0.1:4179/login',
    'https://paperloom-frontend.onrender.com.example.org/',
    'https://example.org/?next=https://paperloom-frontend.onrender.com/',
  ]) {
    expect(retiredSiteDestination(href)).toBeNull();
  }
});

test('retired links cannot redirect to an arbitrary host or forward URL credentials', () => {
  const destination = new URL(retiredSiteDestination(
    'https://old-user:old-password@paperloom-frontend.onrender.com//attacker.invalid/path?next=https://attacker.invalid/#fragment',
  ));
  expect(destination.origin).toBe('https://paperloom.onrender.com');
  expect(destination.username).toBe('');
  expect(destination.password).toBe('');
  expect(destination.pathname).toBe('//attacker.invalid/path');
  expect(destination.search).toBe('?next=https://attacker.invalid/');
});

test('the built showcase forwards before rendering or requesting application data', async ({ page }) => {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  const apiRequests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });
  await page.route('https://paperloom-frontend.onrender.com/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const asset = pathname.startsWith('/assets/') ? pathname.slice(1) : 'index.html';
    const path = resolve(dist, asset);
    expect(path.startsWith(resolve(dist) + sep)).toBe(true);
    const contentType = path.endsWith('.js') ? 'application/javascript'
      : path.endsWith('.css') ? 'text/css'
        : path.endsWith('.woff2') ? 'font/woff2' : 'text/html';
    await route.fulfill({ status: 200, contentType, body: await readFile(path) });
  });
  await page.route('https://paperloom.onrender.com/**', route => route.fulfill({
    status: 200, contentType: 'text/html', body: '<main>Main website destination</main>',
  }));
  await page.goto('https://paperloom-frontend.onrender.com/browse?search=research#papers');
  await expect(page).toHaveURL('https://paperloom.onrender.com/browse?search=research#papers');
  await expect(page.locator('main')).toHaveText('Main website destination');
  expect(apiRequests).toEqual([]);
});
