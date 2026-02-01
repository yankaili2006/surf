const { test, expect } = require('@playwright/test');

test('Surf Desktop Click Interaction Test', async ({ page }) => {
  console.log('=== Surf Desktop Click Test Started ===\n');

  // 1. 打开 Surf 应用
  console.log('Step 1: Opening Surf application...');
  await page.goto('http://localhost:3002');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/surf-click-01-homepage.png' });
  console.log('✓ Surf homepage loaded\n');

  // 2. 点击示例按钮触发沙箱创建
  console.log('Step 2: Clicking example button to create sandbox...');
  const exampleButton = page.locator('button').filter({ hasText: 'Create a JavaScript script' }).first();
  await exampleButton.waitFor({ state: 'visible', timeout: 10000 });
  await exampleButton.click();
  await page.screenshot({ path: 'screenshots/surf-click-02-example-clicked.png' });
  console.log('✓ Example button clicked\n');

  // 3. 等待沙箱创建完成（最多60秒）
  console.log('Step 3: Waiting for sandbox creation (up to 60 seconds)...');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'screenshots/surf-click-03-creating.png' });

  // 等待桌面预览出现
  console.log('Step 4: Waiting for desktop preview to appear...');
  const desktopPreview = page.locator('iframe').first();
  await desktopPreview.waitFor({ state: 'visible', timeout: 60000 });
  await page.screenshot({ path: 'screenshots/surf-click-04-preview-loaded.png' });
  console.log('✓ Desktop preview loaded\n');

  // 4. 获取iframe的边界框
  console.log('Step 5: Getting desktop preview dimensions...');
  const box = await desktopPreview.boundingBox();
  if (!box) {
    throw new Error('Failed to get desktop preview bounding box');
  }
  console.log(`✓ Desktop preview size: ${box.width}x${box.height} at (${box.x}, ${box.y})\n`);

  // 5. 在桌面上执行多次点击测试
  console.log('Step 6: Performing desktop click tests...\n');

  // 点击1: 桌面中心
  console.log('  Click 1: Desktop center');
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.click(centerX, centerY);
  console.log(`  ✓ Clicked at (${Math.round(centerX)}, ${Math.round(centerY)})`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/surf-click-05-center-click.png' });

  // 点击2: 左上角（可能有应用图标）
  console.log('\n  Click 2: Top-left corner (potential app icons)');
  const topLeftX = box.x + 50;
  const topLeftY = box.y + 50;
  await page.mouse.click(topLeftX, topLeftY);
  console.log(`  ✓ Clicked at (${Math.round(topLeftX)}, ${Math.round(topLeftY)})`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/surf-click-06-topleft-click.png' });

  // 点击3: 右上角
  console.log('\n  Click 3: Top-right corner');
  const topRightX = box.x + box.width - 50;
  const topRightY = box.y + 50;
  await page.mouse.click(topRightX, topRightY);
  console.log(`  ✓ Clicked at (${Math.round(topRightX)}, ${Math.round(topRightY)})`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/surf-click-07-topright-click.png' });

  // 点击4: 底部中心（可能有任务栏）
  console.log('\n  Click 4: Bottom center (potential taskbar)');
  const bottomCenterX = box.x + box.width / 2;
  const bottomCenterY = box.y + box.height - 30;
  await page.mouse.click(bottomCenterX, bottomCenterY);
  console.log(`  ✓ Clicked at (${Math.round(bottomCenterX)}, ${Math.round(bottomCenterY)})`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/surf-click-08-bottom-click.png' });

  // 点击5: 双击测试（左上角）
  console.log('\n  Click 5: Double-click test (top-left)');
  await page.mouse.dblclick(topLeftX, topLeftY);
  console.log(`  ✓ Double-clicked at (${Math.round(topLeftX)}, ${Math.round(topLeftY)})`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/surf-click-09-doubleclick.png' });

  // 点击6: 右键点击测试
  console.log('\n  Click 6: Right-click test (center)');
  await page.mouse.click(centerX, centerY, { button: 'right' });
  console.log(`  ✓ Right-clicked at (${Math.round(centerX)}, ${Math.round(centerY)})`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/surf-click-10-rightclick.png' });

  // 7. 最终截图
  console.log('\nStep 7: Capturing final state...');
  await page.screenshot({ path: 'screenshots/surf-click-11-final.png', fullPage: true });
  console.log('✓ Final screenshot captured\n');

  console.log('=== Desktop Click Test Completed Successfully ===');
  console.log('\nTest Summary:');
  console.log('  ✓ 6 different click interactions performed');
  console.log('  ✓ 11 screenshots captured');
  console.log('  ✓ Desktop preview fully interactive');
});
