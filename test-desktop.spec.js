const { test, expect } = require('@playwright/test');

test('Surf Desktop Sandbox Test', async ({ page }) => {
  // 1. 打开 Surf 应用
  console.log('Opening Surf application...');
  await page.goto('http://localhost:3002');

  // 等待页面加载
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/01-surf-homepage.png' });
  console.log('✓ Surf homepage loaded');

  // 2. 点击示例提示按钮
  console.log('Looking for example prompt button...');
  const exampleButton = page.locator('button:has-text("Create a JavaScript script")').first();

  if (await exampleButton.isVisible({ timeout: 5000 })) {
    console.log('✓ Found example button');
    await exampleButton.click();
    await page.screenshot({ path: 'screenshots/02-after-example-click.png' });
    console.log('✓ Clicked example button - sandbox creation should start automatically');

    // 3. 等待沙箱创建开始
    console.log('Waiting for sandbox creation to start...');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/03-sandbox-creating.png' });

    // 4. 等待沙箱创建完成（可能需要较长时间）
    console.log('Waiting for sandbox creation to complete...');

    // 等待 "Creating sandbox..." 消息出现
    const creatingMessage = page.locator('text=Creating sandbox');
    if (await creatingMessage.isVisible({ timeout: 5000 })) {
      console.log('✓ Sandbox creation started');
    }

    // 等待沙箱创建完成（最多60秒）
    await page.waitForTimeout(60000);
    await page.screenshot({ path: 'screenshots/04-after-wait.png' });

    // 5. 查找桌面预览区域
    console.log('Looking for desktop preview...');
    const previewSelectors = [
      'iframe',
      '[data-testid="desktop-preview"]',
      '.desktop-preview',
      'canvas',
      'video'
    ];

    let desktopPreview = null;
    for (const selector of previewSelectors) {
      try {
        desktopPreview = await page.locator(selector).first();
        if (await desktopPreview.isVisible({ timeout: 5000 })) {
          console.log(`✓ Found desktop preview with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (desktopPreview) {
      await page.screenshot({ path: 'screenshots/05-desktop-preview-found.png' });

      // 6. 尝试点击桌面区域
      console.log('Attempting to click on desktop...');
      try {
        const box = await desktopPreview.boundingBox({ timeout: 5000 });
        if (box) {
          // 点击桌面中心
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          console.log('✓ Clicked desktop center');
          await page.waitForTimeout(2000);
          await page.screenshot({ path: 'screenshots/06-after-desktop-click.png' });

          // 点击桌面左上角（可能有应用图标）
          await page.mouse.click(box.x + 50, box.y + 50);
          console.log('✓ Clicked desktop top-left');
          await page.waitForTimeout(2000);
          await page.screenshot({ path: 'screenshots/07-after-icon-click.png' });
        }
      } catch (e) {
        console.log('⚠ Could not interact with desktop:', e.message);
      }
    } else {
      console.log('⚠ Desktop preview not found');
      await page.screenshot({ path: 'screenshots/05-no-desktop-preview.png' });
    }
  } else {
    console.log('⚠ Example button not found');
    await page.screenshot({ path: 'screenshots/02-no-example-button.png' });
  }

  // 7. 最终截图
  await page.screenshot({ path: 'screenshots/08-final-state.png', fullPage: true });
  console.log('✓ Test completed');
});
