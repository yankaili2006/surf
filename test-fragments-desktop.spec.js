const { test, expect } = require('@playwright/test');

test('Fragments Desktop Click Test', async ({ page }) => {
  console.log('=== Fragments Desktop Interaction Test ===');

  // 1. 打开 Fragments 应用
  console.log('1. Opening Fragments application...');
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/fragments-01-homepage.png' });
  console.log('✓ Fragments homepage loaded');

  // 2. 等待页面完全加载
  await page.waitForTimeout(2000);

  // 3. 查找并点击创建沙箱的按钮或输入框
  console.log('2. Looking for sandbox creation controls...');

  // 尝试查找输入框
  const inputSelectors = [
    'input[type="text"]',
    'textarea',
    '[contenteditable="true"]',
    'input[placeholder*="code"]',
    'input[placeholder*="prompt"]'
  ];

  let inputFound = false;
  for (const selector of inputSelectors) {
    try {
      const input = page.locator(selector).first();
      if (await input.isVisible({ timeout: 2000 })) {
        console.log(`✓ Found input with selector: ${selector}`);

        // 输入测试代码
        await input.fill('print("Hello from Fragments desktop!")');
        console.log('✓ Entered test code');
        await page.screenshot({ path: 'screenshots/fragments-02-code-entered.png' });

        inputFound = true;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!inputFound) {
    console.log('⚠ No input found, trying to find Run/Execute button...');
  }

  // 4. 查找并点击运行按钮
  console.log('3. Looking for Run/Execute button...');
  const runButtonSelectors = [
    'button:has-text("Run")',
    'button:has-text("Execute")',
    'button:has-text("Start")',
    'button[type="submit"]',
    'button:has-text("Create")'
  ];

  let runButton = null;
  for (const selector of runButtonSelectors) {
    try {
      runButton = page.locator(selector).first();
      if (await runButton.isVisible({ timeout: 2000 })) {
        console.log(`✓ Found run button with selector: ${selector}`);
        await runButton.click();
        console.log('✓ Clicked run button');
        await page.screenshot({ path: 'screenshots/fragments-03-after-run-click.png' });
        break;
      }
    } catch (e) {
      continue;
    }
  }

  // 5. 等待沙箱创建和桌面加载
  console.log('4. Waiting for sandbox and desktop to load...');
  await page.waitForTimeout(30000); // 等待30秒让沙箱创建
  await page.screenshot({ path: 'screenshots/fragments-04-after-wait.png' });

  // 6. 查找桌面预览区域
  console.log('5. Looking for desktop preview...');
  const desktopSelectors = [
    'iframe',
    'canvas',
    'video',
    '[data-testid="desktop"]',
    '[class*="desktop"]',
    '[class*="preview"]'
  ];

  let desktop = null;
  for (const selector of desktopSelectors) {
    try {
      desktop = page.locator(selector).first();
      if (await desktop.isVisible({ timeout: 5000 })) {
        console.log(`✓ Found desktop with selector: ${selector}`);
        await page.screenshot({ path: 'screenshots/fragments-05-desktop-found.png' });
        break;
      }
    } catch (e) {
      continue;
    }
  }

  // 7. 点击桌面
  if (desktop) {
    console.log('6. Clicking on desktop...');
    try {
      const box = await desktop.boundingBox({ timeout: 5000 });
      if (box) {
        console.log(`Desktop dimensions: ${box.width}x${box.height} at (${box.x}, ${box.y})`);

        // 点击桌面中心
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        await page.mouse.click(centerX, centerY);
        console.log(`✓ Clicked desktop center at (${centerX}, ${centerY})`);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'screenshots/fragments-06-after-center-click.png' });

        // 点击桌面左上角
        const topLeftX = box.x + 100;
        const topLeftY = box.y + 100;
        await page.mouse.click(topLeftX, topLeftY);
        console.log(`✓ Clicked desktop top-left at (${topLeftX}, ${topLeftY})`);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'screenshots/fragments-07-after-topleft-click.png' });

        // 点击桌面右下角
        const bottomRightX = box.x + box.width - 100;
        const bottomRightY = box.y + box.height - 100;
        await page.mouse.click(bottomRightX, bottomRightY);
        console.log(`✓ Clicked desktop bottom-right at (${bottomRightX}, ${bottomRightY})`);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'screenshots/fragments-08-after-bottomright-click.png' });

        console.log('✓ Desktop interaction completed successfully');
      } else {
        console.log('⚠ Could not get desktop bounding box');
      }
    } catch (e) {
      console.log(`⚠ Error interacting with desktop: ${e.message}`);
      await page.screenshot({ path: 'screenshots/fragments-error.png' });
    }
  } else {
    console.log('⚠ Desktop preview not found');
    await page.screenshot({ path: 'screenshots/fragments-no-desktop.png' });
  }

  // 8. 最终截图
  await page.screenshot({ path: 'screenshots/fragments-09-final.png', fullPage: true });
  console.log('✓ Test completed');
  console.log('=== End of Fragments Desktop Test ===');
});
