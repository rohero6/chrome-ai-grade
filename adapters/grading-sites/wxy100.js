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

  /**
   * 提取零分题列表（在页面上下文中执行）
   * @param {Object} reviewHistory 回评历史记录 { index: reviewCount }
   * @returns {Promise<Array>} 零分题列表 [{ index, id, score, reviewCount }]
   */
  extractZeroScoreList(reviewHistory = {}) {
    console.log('[wxy100] 开始提取零分题');
    console.log('[wxy100] reviewHistory:', reviewHistory);
    console.log('[wxy100] window.__aiGradingExtractZeroScore 存在:', typeof window.__aiGradingExtractZeroScore !== 'undefined');
    
    return new Promise((resolve) => {
      const requestId = 'zero_' + Date.now() + '_' + Math.random();
      console.log('[wxy100] requestId:', requestId);
      
      let resolved = false;
      let timeoutId = null;
      
      // 监听页面返回的结果
      const handler = (event) => {
        console.log('[wxy100] 收到事件:', event.type, event.detail);
        if (event.detail && event.detail.type === 'ZERO_SCORE_RESULT' && event.detail.requestId === requestId) {
          console.log('[wxy100] ✅ 收到匹配的结果，零分题数量:', event.detail.list?.length || 0);
          if (timeoutId) clearTimeout(timeoutId);
          document.removeEventListener('aiGradingResult', handler);
          resolved = true;
          resolve(event.detail.list || []);
        } else {
          console.log('[wxy100] ⚠️ 收到不匹配的事件:', event.detail?.requestId, '期望:', requestId);
        }
      };
      document.addEventListener('aiGradingResult', handler);
      console.log('[wxy100] ✅ 已添加事件监听器');
      
      // 设置超时
      timeoutId = setTimeout(() => {
        if (!resolved) {
          console.log('[wxy100] ❌ 超时，未收到结果');
          document.removeEventListener('aiGradingResult', handler);
          resolve([]);
        }
      }, 3000);
      
      // 调用页面中的函数
      if (window.__aiGradingExtractZeroScore) {
        console.log('[wxy100] ✅ 调用页面函数');
        try {
          window.__aiGradingExtractZeroScore(reviewHistory, requestId);
        } catch (e) {
          console.error('[wxy100] ❌ 调用页面函数失败:', e);
          if (timeoutId) clearTimeout(timeoutId);
          document.removeEventListener('aiGradingResult', handler);
          resolve([]);
        }
      } else {
        console.log('[wxy100] ⚠️ 页面函数未注入，等待...');
        // 如果函数还没注入，等待一下
        setTimeout(() => {
          if (window.__aiGradingExtractZeroScore) {
            console.log('[wxy100] ✅ 页面函数已注入，调用');
            try {
              window.__aiGradingExtractZeroScore(reviewHistory, requestId);
            } catch (e) {
              console.error('[wxy100] ❌ 调用页面函数失败:', e);
              if (timeoutId) clearTimeout(timeoutId);
              document.removeEventListener('aiGradingResult', handler);
              resolve([]);
            }
          } else {
            console.log('[wxy100] ❌ 页面函数仍未注入');
            if (timeoutId) clearTimeout(timeoutId);
            document.removeEventListener('aiGradingResult', handler);
            resolve([]);
          }
        }, 500);
      }
    });
  }

  /**
   * 跳转到指定题目（通过页面脚本执行）
   * @param {number} idx 题目索引（从0开始）
   * @param {string|number} id 题目ID
   * @returns {boolean} 是否成功
   */
  jumpToTask(idx, id) {
    console.log('[wxy100] 开始跳转，idx:', idx, 'id:', id);
    
    return new Promise((resolve) => {
      const requestId = 'jump_' + Date.now() + '_' + Math.random();
      
      // 监听页面返回的结果
      const handler = (event) => {
        if (event.detail && event.detail.type === 'JUMP_RESULT' && event.detail.requestId === requestId) {
          document.removeEventListener('aiGradingJumpResult', handler);
          console.log('[wxy100] ✅ 收到跳转结果:', event.detail.success);
          resolve(event.detail.success === true);
        }
      };
      document.addEventListener('aiGradingJumpResult', handler);
      
      // 设置超时
      setTimeout(() => {
        document.removeEventListener('aiGradingJumpResult', handler);
        console.log('[wxy100] ❌ 跳转超时');
        resolve(false);
      }, 3000);
      
      // 通过 DOM 事件触发页面脚本执行
      const requestEvent = new CustomEvent('aiGradingJumpRequest', {
        detail: {
          type: 'jumpToTask',
          requestId: requestId,
          idx: idx,
          id: id
        }
      });
      document.dispatchEvent(requestEvent);
      console.log('[wxy100] ✅ 跳转请求事件已发送');
    }).then(success => {
      // 转换为同步返回（为了兼容现有代码）
      return success;
    }).catch(() => false);
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.Wxy100Adapter = Wxy100Adapter;
  
  // 添加调试工具函数
  window.debugWxy100Scope = function() {
    console.log('=== Wxy100 Angular Scope 调试工具 ===');
    
    // 检查 Angular
    if (typeof angular === 'undefined') {
      console.error('❌ Angular 未加载');
      console.log('提示：请确认页面使用的是 AngularJS 1.x');
      return null;
    }
    console.log('✅ Angular 已加载，版本:', angular.version?.full || '未知');
    
    // 尝试获取 scope
    const selectors = ['#frame2', '[ng-app]', '[ng-controller]', 'body'];
    const results = [];
    
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) {
        console.log(`⚠️ 未找到元素: ${selector}`);
        continue;
      }
      
      try {
        const scope = angular.element(el).scope();
        const isolateScope = angular.element(el).isolateScope();
        
        results.push({
          selector,
          element: el,
          scope: scope,
          isolateScope: isolateScope,
          hasTaskList: !!(scope?.taskList || scope?.$root?.taskList)
        });
        
        if (scope) {
          console.log(`✅ ${selector}: 找到 scope`);
          if (scope.taskList) console.log(`   - scope.taskList: ${scope.taskList.length} 项`);
          if (scope.$root?.taskList) console.log(`   - scope.$root.taskList: ${scope.$root.taskList.length} 项`);
        } else {
          console.log(`⚠️ ${selector}: 未找到 scope`);
        }
      } catch (error) {
        console.log(`❌ ${selector}: 错误 -`, error.message);
      }
    }
    
    // 查找包含 taskList 的元素
    console.log('\n=== 查找包含 taskList 的元素 ===');
    const allElements = document.querySelectorAll('*');
    let foundCount = 0;
    
    for (let i = 0; i < Math.min(allElements.length, 200); i++) {
      try {
        const el = allElements[i];
        const scope = angular.element(el).scope();
        if (scope && (scope.taskList || scope.$root?.taskList)) {
          foundCount++;
          console.log(`✅ 找到 #${foundCount}:`, el.tagName, el.id || el.className);
          console.log('   scope:', scope);
          if (scope.taskList) {
            console.log(`   taskList (${scope.taskList.length} 项):`, scope.taskList[0]);
          }
          if (scope.$root?.taskList) {
            console.log(`   $root.taskList (${scope.$root.taskList.length} 项):`, scope.$root.taskList[0]);
          }
          if (foundCount >= 3) break; // 只显示前3个
        }
      } catch (e) {
        // 忽略
      }
    }
    
    if (foundCount === 0) {
      console.log('⚠️ 未找到包含 taskList 的元素');
    }
    
    return results;
  };
  
  console.log('[wxy100] 调试工具已加载，在控制台输入 debugWxy100Scope() 进行调试');
}

export default Wxy100Adapter;

