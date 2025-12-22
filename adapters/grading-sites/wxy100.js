// adapters/grading-sites/wxy100.js
// wxy100.com 改卷网站适配器

import GradingSiteAdapter from './base.js';

class Wxy100Adapter extends GradingSiteAdapter {
  constructor() {
    super();
    this.name = 'wxy100';
    this.displayName = '问学堂 (wxy100.com)';
    this.matchPatterns = [
      '*://*.wxy100.com/*',
      '*://exam.wxy100.com/*'
    ];
  }

  /**
   * 检测页面是否准备就绪
   */
  isReady() {
    // 检查是否有答题图片区域
    const hasImgContainer = document.querySelector('div[ng-repeat="img in imgs"]') !== null;
    const hasScoreButtons = document.querySelector('.scoreBtnList') !== null;
    return hasImgContainer || hasScoreButtons;
  }

  /**
   * 获取学生答题图片 URL 列表
   */
  getAnswerImageUrls() {
    const imgElements = document.querySelectorAll(
      'div[ng-repeat="img in imgs"] img[ng-src], ' +
      'img[src^="http"]'
    );
    
    const urls = [];
    imgElements.forEach(img => {
      let src = img.getAttribute('ng-src') || img.src;
      if (src) {
        // 处理协议相对 URL
        if (src.startsWith('//')) {
          src = 'http:' + src;
        }
        // 移除查询参数（可能含 token，确保去重）
        urls.push(src.split('?')[0]);
      }
    });
    
    // 去重
    return Array.from(new Set(urls));
  }

  /**
   * 自动填入分数
   */
  fillScore(score) {
    const scoreStr = String(score);
    
    // 尝试多种选择器
    const selectors = [
      '.scoreBtnList .btn6',
      '.scoreBtnList span',
      '.scoreBtnList button',
      '.score-btn',
      '[ng-click*="score"]'
    ];

    for (const selector of selectors) {
      const buttons = document.querySelectorAll(selector);
      for (const btn of buttons) {
        if (btn.innerText.trim() === scoreStr) {
          // 单击
          btn.click();
          // 双击确认
          btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          console.log(`[wxy100] 点击分数按钮: ${scoreStr}`);
          return true;
        }
      }
    }

    // 如果有输入框，直接填入
    const scoreInput = document.querySelector('input[ng-model*="score"], input.score-input');
    if (scoreInput) {
      scoreInput.value = scoreStr;
      scoreInput.dispatchEvent(new Event('input', { bubbles: true }));
      scoreInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`[wxy100] 填入分数输入框: ${scoreStr}`);
      return true;
    }

    console.warn(`[wxy100] 未找到分数 ${scoreStr} 的按钮`);
    return false;
  }

  /**
   * 跳转到下一题
   */
  goToNext() {
    // 尝试多种下一题按钮选择器
    const selectors = [
      '.next-btn',
      '[ng-click*="next"]',
      '.icon-next',
      'button:contains("下一")',
      '[class*="next"]',
      '.btn-next'
    ];

    for (const selector of selectors) {
      const btn = document.querySelector(selector);
      if (btn) {
        btn.click();
        console.log(`[wxy100] 点击下一题按钮`);
        return true;
      }
    }

    // 尝试通过文本内容查找
    const allButtons = document.querySelectorAll('button, .btn, [ng-click]');
    for (const btn of allButtons) {
      if (btn.innerText.includes('下一') || btn.innerText.includes('Next')) {
        btn.click();
        console.log(`[wxy100] 通过文本找到下一题按钮`);
        return true;
      }
    }

    console.warn('[wxy100] 未找到下一题按钮');
    return false;
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.Wxy100Adapter = Wxy100Adapter;
}

export default Wxy100Adapter;

