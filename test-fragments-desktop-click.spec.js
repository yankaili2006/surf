const { test, expect } = require('@playwright/test');

test('Fragments Desktop Click Test', async ({ page }) => {
  // 1. 打开 Fragments 应用
  console.log('Opening Fragments application...');
  await page.goto('http://localhost:3001');

  // 等待页面加载
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots-fragments/01-fragments-homepage.png' });
  console.log('✓ Fragments homepage loaded');

  // 2. 点击 "Run" 按钮创建沙箱
  console.log('Looking for Run button...');

  const runButton = page.locator('button:has-text("Run")').first();
  if (await runButton.isVisible({ timeout: 5000 })) {
    console.log('✓ Found Run button');
    await runButton.click();
    await page.screenshot({ path: 'screenshots-fragments/02-after-run-click.png' });
    console.log('✓ Clicked Run button');
  } else {
    console.log('⚠ Run button not found, checking page content...');
    await page.screenshot({ path: 'screenshots-fragments/02-no-run-button.png' });
  }

  // 3. 等待沙箱创建（根据日志显示需要约7秒）
  console.log('Waiting for sandbox creation (10 seconds)...');
  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'screenshots-fragments/03-after-wait-10s.png' });

  // 4. 查找所有可能的桌面预览元素
  console.log('Looking for desktop preview elements...');

  const previewSelectors = [
    'iframe',
    'canvas',
    'video',
    '[data-testid="desktop-preview"]',
    '.desktop-preview',
    '[class*="desktop"]',
    '[class*="preview"]',
    '[id*="desktop"]',
    '[id*="preview"]'
  ];

  let desktopElement = null;
  let foundSelector = null;

  for (const selector of previewSelectors) {
    try {
      const elements = await page.locator(selector).all();
      console.log(`  Checking selector "${selector}": found ${elements.length} elements`);

      for (let i = 0; i < elements.length; i++) {
        if (await elements[i].isVisible({ timeout: 1000 })) {
          desktopElement = elements[i];
          foundSelector = `${selector}[${i}]`;
          console.log(`✓ Found visible desktop element: ${foundSelector}`);
          break;
        }
      }

      if (desktopElement) break;
    } catch (e) {
      // 继续尝试下一个选择器
    }
  }

  if (desktopElement) {
    await page.screenshot({ path: 'screenshots-fragments/04-desktop-found.png' });

    // 5. 获取元素位置并点击
    console.log('Getting element bounding box...');
    const box = await desktopElement.boundingBox();

    if (box) {
      console.log(`Element box: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`);

      // 点击中心
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      console.log(`Clicking center at (${centerX}, ${centerY})...`);
      await page.mouse.click(centerX, centerY);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots-fragments/05-after-center-click.png' });
      console.log('✓ Clicked desktop center');

      // 点击左上角
      const topLeftX = box.x + 50;
      const topLeftY = box.y + 50;
      console.log(`Clicking top-left at (${topLeftX}, ${topLeftY})...`);
      await page.mouse.click(topLeftX, topLeftY);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots-fragments/06-after-topleft-click.png' });
      console.log('✓ Clicked desktop top-left');

      // 点击右下角
      const bottomRightX = box.x + box.width - 50;
      const bottomRightY = box.y + box.height - 50;
      console.log(`Clicking bottom-right at (${bottomRightX}, ${bottomRightY})...`);
      await page.mouse.click(bottomRightX, bottomRightY);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots-fragments/07-after-bottomright-click.png' });
      console.log('✓ Clicked desktop bottom-right');
    } else {
      console.log('⚠ Could not get element bounding box');
      await page.screenshot({ path: 'screenshots-fragments/05-no-bounding-box.png' });
    }
  } else {
    console.log('⚠ No desktop preview element found');
    await page.screenshot({ path: 'screenshots-fragments/04-no-desktop-found.png' });

    // 列出页面上所有可见元素
    console.log('Listing all visible elements on page...');
    const allElements = await page.locator('*').all();
    console.log(`Total elements on page: ${allElements.length}`);

    // 获取页面HTML结构
    const bodyHTML = await page.locator('body').innerHTML();
    console.log('Page body HTML length:', bodyHTML.length);
  }

  // 6. 最终截图
  await page.screenshot({ path: 'screenshots-fragments/08-final-state.png', fullPage: true });
  console.log('✓ Test completed');
});
