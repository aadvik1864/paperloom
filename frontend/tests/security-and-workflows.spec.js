import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const author = { id: 42, profile_name: 'Research Lab', role: 'author' };
const draft = { id: 61, title: 'Secret draft', content: '# Research\n\nDraft content', slug: 'secret-draft', status: 'draft', author_id: 42, view_count: 0 };
const paper = { id: 71, title: 'Research paper', abstract: 'Research abstract', authors: 'Research Lab', category_id: 1, status: 'published', view_count: 2 };

async function session(page, user = author) {
  await page.addInitScript(user => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', 'mock-session-only');
  }, user);
}

async function mockApi(page, { user = author, handle } = {}) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (handle && await handle(route, url)) return;
    let data = { papers: [], blogs: [], categories: [], bookmarks: [], users: [], page: 1, pages: 1, total: 0 };
    if (path === '/api/auth/me' || path === '/api/users/42') data = { user };
    if (path === '/api/users/dashboard' || path === '/api/admin/analytics') data = { stats: {}, recent_papers: [], recent_blogs: [] };
    if (path === '/api/papers/categories') data = { categories: [{ id: 1, name: 'Computer Science' }] };
    if (path === '/api/papers/capabilities') data = { extensions: ['.pdf'], office_conversion: false };
    if (path === '/api/users/bookmarks') data = { bookmarks: [paper] };
    if (path === '/api/admin/users') data = { users: [{ ...author, role: 'admin' }], page: 1, pages: 1 };
    await route.fulfill({ json: data });
  });
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function accessible(page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) }))).toEqual([]);
}

test('unknown routes have a useful not-found screen', async ({ page }) => {
  await mockApi(page);
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse papers', exact: true })).toBeVisible();
});

test('readers can open bookmarks but cannot see publishing controls', async ({ page }) => {
  const user = { ...author, role: 'visitor' };
  await session(page, user);
  await mockApi(page, { user });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Bookmarked Papers' })).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: /^Research paper\b/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload Paper', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Bookmarks', exact: true })).toBeVisible();
});

test('drafts can be edited and published without creating duplicate posts', async ({ page }) => {
  await session(page);
  let current = { ...draft };
  const updates = [];
  await mockApi(page, { handle: async (route, url) => {
    if (url.pathname === '/api/blogs' && route.request().method() === 'GET') {
      expect(url.searchParams.get('status')).toBe('all');
      await route.fulfill({ json: { blogs: [current], pages: 1 } });
      return true;
    }
    if (url.pathname === '/api/blogs/61' && route.request().method() === 'PUT') {
      const update = route.request().postDataJSON();
      updates.push(update);
      current = { ...current, ...update };
      await route.fulfill({ json: { blog: current } });
      return true;
    }
  }});
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'My Blogs', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Secret draft', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Content (Markdown) *')).toHaveValue(draft.content);
  await page.getByLabel('Title *', { exact: true }).fill('Updated draft');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Updated draft', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publish draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publish draft', exact: true })).toHaveCount(0);
  expect(updates).toHaveLength(2);
  expect(updates[1]).toEqual({ status: 'published' });
});

test('paper editor saves metadata without requiring another PDF', async ({ page }) => {
  await session(page);
  let saved = false;
  await mockApi(page, { handle: async (route, url) => {
    if (url.pathname === '/api/papers' && route.request().method() === 'GET') {
      expect(url.searchParams.get('status')).toBe('all');
      await route.fulfill({ json: { papers: [paper], pages: 1 } });
      return true;
    }
    if (url.pathname === '/api/papers/71' && route.request().method() === 'PUT') {
      expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary=');
      saved = true;
      await route.fulfill({ json: { paper } });
      return true;
    }
  }});
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'My Papers', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title *', { exact: true }).fill('Updated title');
  await page.getByRole('button', { name: 'Save Paper', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Papers' })).toBeVisible();
  expect(saved).toBe(true);
});

test('a delayed profile check cannot undo logout', async ({ page }) => {
  await session(page);
  let release;
  let started;
  const pending = new Promise(resolve => { release = resolve; });
  const requested = new Promise(resolve => { started = resolve; });
  await mockApi(page, { handle: async (route, url) => {
    if (url.pathname === '/api/auth/me') {
      started();
      await pending;
      await route.fulfill({ json: { user: author } });
      return true;
    }
  }});
  await page.goto('/');
  await requested;
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  const response = page.waitForResponse('**/api/auth/me');
  release();
  await response;
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem('token'), localStorage.getItem('user')])).toEqual([null, null]);
});

test('stale unauthorized responses do not clear a newer token', async ({ page }) => {
  await session(page);
  let release;
  let started;
  const pending = new Promise(resolve => { release = resolve; });
  const requested = new Promise(resolve => { started = resolve; });
  await mockApi(page, { handle: async (route, url) => {
    if (url.pathname === '/api/auth/me') {
      started();
      await pending;
      await route.fulfill({ status: 401, json: { message: 'Old session expired' } });
      return true;
    }
  }});
  await page.goto('/');
  await requested;
  await page.evaluate(() => localStorage.setItem('token', 'newer-mock-session'));
  const response = page.waitForResponse('**/api/auth/me');
  release();
  await response;
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('newer-mock-session');
});

test('profile 404 navigation clears the previously displayed user', async ({ page }) => {
  await mockApi(page, { handle: async (route, url) => {
    if (url.pathname === '/api/users/999') {
      await route.fulfill({ status: 404, json: { message: 'User not found' } });
      return true;
    }
  }});
  await page.goto('/profile/42');
  await expect(page.getByRole('heading', { name: author.profile_name, exact: true })).toBeVisible();
  await page.evaluate(() => { history.pushState({}, '', '/profile/999'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByText('User not found.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: author.profile_name, exact: true })).toHaveCount(0);
});

test('Markdown renders safely and blog 404 navigation clears old content', async ({ page }) => {
  await mockApi(page, { handle: async (route, url) => {
    if (url.pathname.startsWith('/api/blogs/')) {
      await route.fulfill({ status: url.pathname.endsWith('/missing') ? 404 : 200, json: { blog: {
        ...draft, status: 'published', content: '# Heading\n\n**Bold text** and [safe](https://example.com)\n\n[unsafe](javascript:window.compromised=true)\n\n<img src=x onerror="window.compromised=true">',
      }}});
      return true;
    }
  }});
  await page.goto('/blogs/secret-draft');
  await expect(page.locator('.markdown-content h1')).toHaveText('Heading');
  await expect(page.locator('.markdown-content strong')).toHaveText('Bold text');
  await expect(page.locator('.markdown-content img')).toHaveCount(0);
  expect(await page.getByRole('link', { name: 'unsafe', exact: true }).getAttribute('href')).not.toContain('javascript:');
  expect(await page.evaluate(() => Boolean(window.compromised))).toBe(false);
  await page.evaluate(() => { history.pushState({}, '', '/blogs/missing'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByText('Blog not found.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: draft.title, exact: true })).toHaveCount(0);
});

for (const role of ['author', 'admin']) {
  test(`${role} dashboard and forms are mobile-friendly and accessible`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const user = { ...author, role };
    await session(page, user);
    await mockApi(page, { user });
    await page.goto(role === 'admin' ? '/admin' : '/dashboard');
    await expect(page.getByRole('heading', { name: role === 'admin' ? 'Admin Dashboard' : 'Dashboard', exact: true })).toBeVisible();
    await noOverflow(page);
    const tabs = role === 'admin' ? ['Create Profile', 'Profiles'] : ['Upload Paper', 'Write Blog', 'Edit Profile'];
    for (const tab of tabs) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await page.locator('main input, main select').first().waitFor();
      await noOverflow(page);
      await accessible(page);
    }
    await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
    for (const tab of tabs) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await page.locator('main input, main select').first().waitFor();
      await noOverflow(page);
      await accessible(page);
    }
  });
}

test('admin password reset is masked and never cached or logged', async ({ page }) => {
  const user = { ...author, role: 'admin' };
  const consoleMessages = [];
  page.on('console', message => consoleMessages.push(message.text()));
  await session(page, user);
  await mockApi(page, { user });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Profiles', exact: true }).click();
  await page.getByRole('button', { name: 'Set Password', exact: true }).click();
  const field = page.getByLabel('New password', { exact: true });
  await expect(field).toHaveAttribute('type', 'password');
  await field.fill('Private-test-password-only');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(field).toHaveCount(0);
  expect(consoleMessages.join('\n')).not.toContain('Private-test-password-only');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('Private-test-password-only');
});

test('login inputs are labeled and passwords are masked', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');
  await expect(page.getByLabel('Profile Name', { exact: true })).toHaveAttribute('autocomplete', 'username');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await accessible(page);
});
