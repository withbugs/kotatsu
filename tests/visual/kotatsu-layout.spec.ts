import { expect, test } from '@playwright/test';

const paths = ['/kotatsu/', '/kotatsu/issues/issue-001/'];

for (const targetPath of paths) {
  test(`KOTATSU layout renders without overflow: ${targetPath}`, async ({ page }, testInfo) => {
    await page.goto(targetPath);
    await expect(page.locator('.site-mark img')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();

    await page.evaluate(async () => {
      for (let y = 0; y <= document.documentElement.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }
      window.scrollTo(0, 0);
    });

    await page.waitForFunction(() =>
      Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0)
    );

    const metrics = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('.site-nav');
      const navLinks = Array.from(document.querySelectorAll<HTMLElement>('.site-nav a'));

      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        navScrollbarWidth: nav ? nav.offsetHeight - nav.clientHeight : 0,
        navNeedsHorizontalScroll: nav ? nav.scrollWidth > nav.clientWidth + 2 : false,
        navLinksInViewport: navLinks.every((link) => {
          const rect = link.getBoundingClientRect();
          return rect.left >= -1 && rect.right <= window.innerWidth + 1 && rect.width > 0 && rect.height > 0;
        }),
        imageCount: document.images.length,
        brokenImages: Array.from(document.images).filter((img) => !img.complete || img.naturalWidth === 0).length
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
    expect(metrics.navScrollbarWidth).toBe(0);
    expect(metrics.navNeedsHorizontalScroll).toBe(false);
    expect(metrics.navLinksInViewport).toBe(true);
    expect(metrics.imageCount).toBeGreaterThan(0);
    expect(metrics.brokenImages).toBe(0);

    const screenshotPath = testInfo.outputPath('screenshots', `${targetPath.replace(/\W+/g, '-') || 'home'}.png`);
    const screenshot = await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`screenshot-${targetPath.replace(/\W+/g, '-') || 'home'}.png`, {
      body: screenshot,
      contentType: 'image/png'
    });
  });
}

test('planning issue hides cover image and article table of contents', async ({ page }) => {
  await page.goto('/kotatsu/');

  await expect(page.getByRole('heading', { name: '準備中', exact: true })).toBeVisible();
  await expect(page.getByText('創刊号の記事')).toHaveCount(0);
  await expect(page.getByText('Coming Soon')).toHaveCount(0);
  await expect(page.getByText('Comming Soon')).toHaveCount(0);
  await expect(page.getByText('Issue planning')).toHaveCount(0);
  await expect(page.getByText('NOW PLANNING')).toHaveCount(0);
  await expect(page.getByText('編集長')).toHaveCount(0);
  await expect(page.getByText('進行編集')).toHaveCount(0);
  await expect(page.getByText('AI生成ビジュアル方針')).toHaveCount(0);
  await expect(page.getByText('月刊号設計')).toHaveCount(0);
  await expect(page.locator('img[src$="/images/issues/001/cover-weekend-clothes.png"]')).toHaveCount(0);

  const articleTitles = [
    '大人の週末服',
    '白シャツを、週末の生活着としてもう一度',
    '喫茶店に行く日の服と持ち物',
    '長く使える週末の道具'
  ];

  for (const title of articleTitles.slice(1)) {
    await expect(page.getByText(title)).toHaveCount(0);
  }

  for (const slug of ['issue-001-cover', 'white-shirt-weekend', 'cafe-clothes-and-belongings', 'weekend-tools']) {
    await expect(page.locator(`a[href="/kotatsu/articles/${slug}/"]`)).toHaveCount(0);
  }
});






