import type { Page, TestInfo } from '@playwright/test';
export async function attachCloudMetrics(page: Page, info: TestInfo, route: string, candidate: boolean) {
  const session = await page.context().newCDPSession(page);
  await session.send('DOM.enable'); await session.send('CSS.enable');
  const { root } = await session.send('DOM.getDocument');
  const nodes = await session.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'h1,h2,p' });
  const fonts = [];
  for (const nodeId of nodes.nodeIds.slice(0, 16)) fonts.push(...(await session.send('CSS.getPlatformFontsForNode', { nodeId })).fonts);
  await session.detach();
  const metrics = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio,
    scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
    imageCount: document.images.length, brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).length,
    bodyCharacters: document.querySelector('.article-content')?.textContent?.trim().length ?? 0
  }));
  await info.attach('cloud-metrics', { body: Buffer.from(JSON.stringify({ route, candidate, fonts, ...metrics })), contentType: 'application/json' });
}
