import { test, expect } from '@playwright/test';
import { attachCloudMetrics } from './cloud-metrics';
const slug = process.env.KOTATSU_VISUAL_CANDIDATE;
if (slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('invalid candidate slug');
  test('candidate article has rendered body and hero', async ({ page }, info) => {
    const route = `/kotatsu/articles/${slug}/`;
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('.article-content')).toBeVisible();
    expect((await page.locator('.article-content').innerText()).trim().length).toBeGreaterThanOrEqual(100);
    await expect(page.locator('.article-hero__image img')).toBeVisible();
    await page.evaluate(async () => {
      for (let y=0; y<=document.documentElement.scrollHeight; y+=innerHeight) { scrollTo(0,y); await new Promise(r=>setTimeout(r,80)); }
      scrollTo(0,0); await document.fonts.ready;
    });
    await page.waitForFunction(()=>[...document.images].every(i=>i.complete && i.naturalWidth>0));
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
    expect(overflow).toBe(false);
    await attachCloudMetrics(page, info, route, true);
    const screenshot=await page.screenshot({path:info.outputPath('screenshots','candidate.jpg'),fullPage:true,type:'jpeg',quality:85});
    await info.attach('screenshot-candidate',{body:screenshot,contentType:'image/jpeg'});
  });
}
