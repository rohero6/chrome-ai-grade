// content-scripts/grading-site-loader.js
// 改卷网站适配器加载器

(function() {
  'use strict';
  
  console.log('[AI阅卷] 改卷网站加载器启动...');
  
  // 注入页面脚本（在页面上下文中执行，绕过 CSP）
  function injectPageScript() {
    if (window.__aiGradingPageScriptInjected) {
      console.log('[AI阅卷] 页面脚本已注入，跳过');
      // 即使标记已注入，也检查一下函数是否存在
      setTimeout(() => {
        const exists = typeof window.__aiGradingExtractZeroScore !== 'undefined';
        console.log('[AI阅卷] 检查页面函数是否存在:', exists);
        if (!exists) {
          console.log('[AI阅卷] ⚠️ 函数不存在，重新注入...');
          window.__aiGradingPageScriptInjected = false;
          injectPageScript();
        }
      }, 100);
      return;
    }
    
    console.log('[AI阅卷] 开始注入页面脚本...');
    console.log('[AI阅卷] chrome.runtime:', typeof chrome !== 'undefined' && chrome.runtime);
    
    try {
      const scriptUrl = chrome.runtime.getURL('page-scripts/angular-extractor.js');
      console.log('[AI阅卷] 脚本URL:', scriptUrl);
      
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.onload = function() {
        console.log('[AI阅卷] ✅ 页面脚本加载成功');
        this.remove();
        // 检查函数是否已注入（需要等待脚本执行）
        setTimeout(() => {
          const extractExists = typeof window.__aiGradingExtractZeroScore !== 'undefined';
          const jumpExists = typeof window.__aiGradingJumpToTask !== 'undefined';
          console.log('[AI阅卷] 检查页面函数:', {
            extractZeroScore: extractExists,
            jumpToTask: jumpExists
          });
          if (!extractExists) {
            console.error('[AI阅卷] ❌ 页面函数未注入，可能脚本执行失败');
          }
        }, 200);
      };
      script.onerror = function(e) {
        console.error('[AI阅卷] ❌ 页面脚本加载失败:', e);
        console.error('[AI阅卷] 脚本URL:', scriptUrl);
        console.error('[AI阅卷] 请检查 manifest.json 中的 web_accessible_resources 配置');
      };
      
      (document.head || document.documentElement).appendChild(script);
      window.__aiGradingPageScriptInjected = true;
      console.log('[AI阅卷] 页面脚本标签已添加到DOM');
    } catch (e) {
      console.error('[AI阅卷] ❌ 注入页面脚本时出错:', e);
    }
  }
  
  // 立即尝试注入
  console.log('[AI阅卷] 准备注入页面脚本，document.readyState:', document.readyState);
  
  // 如果页面已加载，立即注入
  if (document.readyState === 'loading') {
    console.log('[AI阅卷] 页面正在加载，等待 DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[AI阅卷] DOMContentLoaded 触发，注入页面脚本');
      injectPageScript();
    });
  } else {
    // 延迟注入，确保页面完全加载
    console.log('[AI阅卷] 页面已加载，延迟注入页面脚本');
    setTimeout(() => {
      console.log('[AI阅卷] 执行延迟注入');
      injectPageScript();
    }, 200);
  }
  
  // 也监听页面加载完成事件
  window.addEventListener('load', () => {
    console.log('[AI阅卷] 页面加载完成，检查页面脚本...');
    if (typeof window.__aiGradingExtractZeroScore === 'undefined') {
      console.log('[AI阅卷] ⚠️ 页面函数不存在，尝试重新注入...');
      window.__aiGradingPageScriptInjected = false;
      injectPageScript();
    } else {
      console.log('[AI阅卷] ✅ 页面函数已存在');
    }
  });
  
  // 在提取零分题时，如果函数不存在，强制注入
  // 这个会在 extractZeroScoreList 函数中调用

  // 适配器映射（非模块环境使用内联定义）
  const adapters = {
    wxy100: {
      name: 'wxy100',
      displayName: '问学堂 (wxy100.com)',
      matchPatterns: ['wxy100.com'],
      
      isReady() {
        const hasImgContainer = document.querySelector('div[ng-repeat="img in imgs"]') !== null;
        const hasScoreButtons = document.querySelector('.scoreBtnList') !== null;
        return hasImgContainer || hasScoreButtons;
      },
      
      getAnswerImageUrls() {
        const imgElements = document.querySelectorAll(
          'div[ng-repeat="img in imgs"] img[ng-src], img[src^="http"]'
        );
        const urls = [];
        imgElements.forEach(img => {
          let src = img.getAttribute('ng-src') || img.src;
          if (src) {
            if (src.startsWith('//')) src = 'http:' + src;
            urls.push(src.split('?')[0]);
          }
        });
        return Array.from(new Set(urls));
      },
      
      fillScore(score) {
        const scoreStr = String(score);
        const selectors = ['.scoreBtnList .btn6', '.scoreBtnList span', '.scoreBtnList button', '.score-btn'];
        
        for (const selector of selectors) {
          const buttons = document.querySelectorAll(selector);
          for (const btn of buttons) {
            if (btn.innerText.trim() === scoreStr) {
              btn.click();
              btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
              return true;
            }
          }
        }
        
        const scoreInput = document.querySelector('input[ng-model*="score"], input.score-input');
        if (scoreInput) {
          scoreInput.value = scoreStr;
          scoreInput.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        return false;
      },
      
      goToNext() {
        const selectors = ['.next-btn', '[ng-click*="next"]', '.icon-next', '.btn-next'];
        for (const selector of selectors) {
          const btn = document.querySelector(selector);
          if (btn) { btn.click(); return true; }
        }
        const allButtons = document.querySelectorAll('button, .btn, [ng-click]');
        for (const btn of allButtons) {
          if (btn.innerText.includes('下一')) { btn.click(); return true; }
        }
        return false;
      },
      
      // 零分题提取功能（通过页面脚本执行）
      extractZeroScoreList(reviewHistory = {}) {
        console.log('[内联适配器] 开始提取零分题');
        console.log('[内联适配器] reviewHistory:', reviewHistory);
        console.log('[内联适配器] window.__aiGradingExtractZeroScore 存在:', typeof window.__aiGradingExtractZeroScore !== 'undefined');
        
        return new Promise((resolve) => {
          const requestId = 'zero_' + Date.now() + '_' + Math.random();
          console.log('[内联适配器] requestId:', requestId);
          
          let resolved = false;
          let timeoutId = null;
          
          // 监听页面返回的结果
          const handler = (event) => {
            console.log('[内联适配器] 收到事件:', event.type, event.detail);
            if (event.detail && event.detail.type === 'ZERO_SCORE_RESULT' && event.detail.requestId === requestId) {
              console.log('[内联适配器] ✅ 收到匹配的结果，零分题数量:', event.detail.list?.length || 0);
              if (timeoutId) clearTimeout(timeoutId);
              document.removeEventListener('aiGradingResult', handler);
              resolved = true;
              resolve(event.detail.list || []);
            } else {
              console.log('[内联适配器] ⚠️ 收到不匹配的事件:', event.detail?.requestId, '期望:', requestId);
            }
          };
          document.addEventListener('aiGradingResult', handler);
          console.log('[内联适配器] ✅ 已添加事件监听器');
          
          // 设置超时
          timeoutId = setTimeout(() => {
            if (!resolved) {
              console.log('[内联适配器] ❌ 超时，未收到结果');
              document.removeEventListener('aiGradingResult', handler);
              resolve([]);
            }
          }, 5000);
          
          // 通过 DOM 事件触发页面脚本执行（不直接调用函数，因为隔离环境）
          console.log('[内联适配器] 发送请求事件到页面...');
          const requestEvent = new CustomEvent('aiGradingRequest', {
            detail: {
              type: 'extractZeroScore',
              requestId: requestId,
              reviewHistory: reviewHistory
            }
          });
          document.dispatchEvent(requestEvent);
          console.log('[内联适配器] ✅ 请求事件已发送');
        });
      },
      
      jumpToTask(idx, id) {
        console.log('[内联适配器] 开始跳转，idx:', idx, 'id:', id);
        
        return new Promise((resolve) => {
          const requestId = 'jump_' + Date.now() + '_' + Math.random();
          
          // 监听页面返回的结果
          const handler = (event) => {
            if (event.detail && event.detail.type === 'JUMP_RESULT' && event.detail.requestId === requestId) {
              document.removeEventListener('aiGradingJumpResult', handler);
              console.log('[内联适配器] ✅ 收到跳转结果:', event.detail.success);
              resolve(event.detail.success === true);
            }
          };
          document.addEventListener('aiGradingJumpResult', handler);
          
          // 设置超时
          setTimeout(() => {
            document.removeEventListener('aiGradingJumpResult', handler);
            console.log('[内联适配器] ❌ 跳转超时');
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
          console.log('[内联适配器] ✅ 跳转请求事件已发送');
        }).then(success => success).catch(() => false);
      }
    }
    // 添加更多适配器...
  };

  // 根据当前 URL 匹配适配器
  function matchAdapter() {
    const url = window.location.href;
    for (const key in adapters) {
      const adapter = adapters[key];
      if (adapter.matchPatterns.some(p => url.includes(p))) {
        return adapter;
      }
    }
    return null;
  }

  // 当前使用的适配器
  let currentAdapter = null;
  let config = { isGrading: false, autoGrading: false };
  
  // 零分题相关状态
  let zeroScoreList = [];
  let reviewHistory = {};
  let reviewIndex = 0;
  let reviewing = false;

  // 注入控制面板
  function injectUI() {
    if (document.getElementById('ai-grading-panel')) return;

    // 读取保存的位置
    const savedPos = localStorage.getItem('ai-grading-panel-pos');
    const defaultPos = { top: 60, left: window.innerWidth - 240 };
    const pos = savedPos ? JSON.parse(savedPos) : defaultPos;

    const panel = document.createElement('div');
    panel.id = 'ai-grading-panel';
    panel.innerHTML = `
      <style>
        #ai-grading-panel {
          position: fixed;
          top: ${pos.top}px;
          left: ${pos.left}px;
          z-index: 99999;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          min-width: 200px;
          color: white;
          user-select: none;
        }
        #ai-grading-panel.collapsed {
          min-width: auto;
          padding: 8px 12px;
          border-radius: 20px;
        }
        #ai-grading-panel.collapsed .panel-body {
          display: none;
        }
        #ai-grading-panel.collapsed .panel-header {
          margin-bottom: 0;
        }
        #ai-grading-panel.dragging {
          opacity: 0.9;
          cursor: grabbing !important;
        }
        #ai-grading-panel * { box-sizing: border-box; }
        #ai-grading-panel .panel-header {
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          cursor: grab;
          padding: 4px 0;
        }
        #ai-grading-panel .panel-header:active {
          cursor: grabbing;
        }
        #ai-grading-panel .header-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        #ai-grading-panel .header-title::before {
          content: '🤖';
          font-size: 18px;
        }
        #ai-grading-panel .toggle-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        #ai-grading-panel .toggle-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        #ai-grading-panel .adapter-info {
          font-size: 11px;
          opacity: 0.8;
          margin-bottom: 10px;
          padding: 6px 10px;
          background: rgba(255,255,255,0.1);
          border-radius: 6px;
        }
        #ai-grading-panel .auto-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          font-size: 13px;
          cursor: pointer;
          padding: 8px 12px;
          background: rgba(255,255,255,0.15);
          border-radius: 8px;
          transition: background 0.2s;
        }
        #ai-grading-panel .auto-toggle:hover {
          background: rgba(255,255,255,0.25);
        }
        #ai-grading-panel .auto-toggle input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        #ai-grading-panel .start-btn {
          width: 100%;
          padding: 10px;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        #ai-grading-panel .start-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        #ai-grading-panel .start-btn:active {
          transform: translateY(0);
        }
        #ai-grading-panel .start-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        #ai-grading-panel .status {
          margin-top: 12px;
          font-size: 12px;
          text-align: center;
          padding: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 6px;
          min-height: 32px;
        }
        #ai-grading-panel .log-container {
          margin-top: 12px;
          max-height: 200px;
          overflow-y: auto;
          background: rgba(0,0,0,0.3);
          border-radius: 6px;
          padding: 8px;
          font-size: 11px;
          font-family: 'Courier New', monospace;
          display: none;
        }
        #ai-grading-panel .log-container.show {
          display: block;
        }
        #ai-grading-panel .log-item {
          margin: 4px 0;
          padding: 4px;
          border-left: 2px solid transparent;
          word-break: break-all;
        }
        #ai-grading-panel .log-item.info {
          color: #87ceeb;
          border-left-color: #87ceeb;
        }
        #ai-grading-panel .log-item.success {
          color: #90ee90;
          border-left-color: #90ee90;
        }
        #ai-grading-panel .log-item.error {
          color: #ff6b6b;
          border-left-color: #ff6b6b;
        }
        #ai-grading-panel .log-item.warn {
          color: #ffd700;
          border-left-color: #ffd700;
        }
        #ai-grading-panel .log-toggle {
          margin-top: 8px;
          font-size: 10px;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          text-align: center;
          padding: 4px;
          border-radius: 4px;
          background: rgba(255,255,255,0.1);
        }
        #ai-grading-panel .log-toggle:hover {
          background: rgba(255,255,255,0.2);
        }
        #ai-grading-panel .drag-hint {
          font-size: 10px;
          opacity: 0.6;
          text-align: center;
          margin-top: 8px;
        }
        #ai-grading-panel .zero-score-section {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,0.2);
        }
        #ai-grading-panel .zero-score-btn {
          width: 100%;
          padding: 8px;
          margin-top: 8px;
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }
        #ai-grading-panel .zero-score-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        #ai-grading-panel .zero-score-list {
          max-height: 150px;
          overflow-y: auto;
          margin-top: 8px;
          background: rgba(0,0,0,0.2);
          border-radius: 6px;
          padding: 6px;
          display: none;
        }
        #ai-grading-panel .zero-score-list.show {
          display: block;
        }
        #ai-grading-panel .zero-score-item {
          padding: 6px 8px;
          margin: 4px 0;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background 0.2s;
        }
        #ai-grading-panel .zero-score-item:hover {
          background: rgba(255,255,255,0.2);
        }
        #ai-grading-panel .zero-score-item-info {
          flex: 1;
        }
        #ai-grading-panel .zero-score-item-count {
          font-size: 10px;
          opacity: 0.7;
          margin-left: 8px;
        }
        #ai-grading-panel .zero-score-stats {
          font-size: 11px;
          opacity: 0.8;
          margin-top: 6px;
          text-align: center;
        }
      </style>
      <div class="panel-header" id="ai-drag-handle">
        <span class="header-title">AI 阅卷助手 v4.0</span>
        <button class="toggle-btn" id="ai-toggle-btn" title="收起/展开">−</button>
      </div>
      <div class="panel-body">
        <div class="adapter-info">
          📍 ${currentAdapter ? currentAdapter.displayName : '未知网站'}
        </div>
        <label class="auto-toggle">
          <input type="checkbox" id="ai-auto-check">
          <span>全自动循环批改</span>
        </label>
        <button class="start-btn" id="ai-start-btn">▶ 开始判分</button>
        <div class="status" id="ai-status">就绪</div>
        <div class="zero-score-section">
          <button class="zero-score-btn" id="ai-zero-score-btn">📋 显示零分题列表</button>
          <div class="zero-score-stats" id="ai-zero-score-stats"></div>
          <div class="zero-score-list" id="ai-zero-score-list"></div>
        </div>
        <div class="zero-score-section">
          <button class="zero-score-btn" id="ai-full-score-btn">✅ 显示满分题列表</button>
          <div class="zero-score-stats" id="ai-full-score-stats"></div>
          <div class="zero-score-list" id="ai-full-score-list"></div>
        </div>
        <div class="log-toggle" id="ai-log-toggle">📋 显示日志</div>
        <div class="log-container" id="ai-log-container"></div>
        <div class="drag-hint">↔ 拖动标题栏移动位置</div>
      </div>
    `;
    
    document.body.appendChild(panel);

    // 拖动功能
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const dragHandle = document.getElementById('ai-drag-handle');
    
    dragHandle.addEventListener('mousedown', (e) => {
      // 如果点击的是按钮，不启动拖动
      if (e.target.closest('.toggle-btn')) return;
      
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      panel.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      let newLeft = e.clientX - dragOffsetX;
      let newTop = e.clientY - dragOffsetY;
      
      // 限制在窗口内
      const maxLeft = window.innerWidth - panel.offsetWidth;
      const maxTop = window.innerHeight - panel.offsetHeight;
      
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
      
      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        panel.classList.remove('dragging');
        
        // 保存位置
        const rect = panel.getBoundingClientRect();
        localStorage.setItem('ai-grading-panel-pos', JSON.stringify({
          top: rect.top,
          left: rect.left
        }));
      }
    });

    // 收起/展开切换
    document.getElementById('ai-toggle-btn').onclick = (e) => {
      e.stopPropagation();
      const panel = document.getElementById('ai-grading-panel');
      const btn = document.getElementById('ai-toggle-btn');
      panel.classList.toggle('collapsed');
      btn.innerText = panel.classList.contains('collapsed') ? '+' : '−';
      btn.title = panel.classList.contains('collapsed') ? '展开' : '收起';
    };

    // 日志功能
    const logContainer = document.getElementById('ai-log-container');
    const logToggle = document.getElementById('ai-log-toggle');
    let logShow = false;

    window.addLog = function(message, type = 'info') {
      if (!logContainer) return;
      const logItem = document.createElement('div');
      logItem.className = `log-item ${type}`;
      const time = new Date().toLocaleTimeString();
      logItem.textContent = `[${time}] ${message}`;
      logContainer.appendChild(logItem);
      logContainer.scrollTop = logContainer.scrollHeight;
      
      // 同时输出到控制台
      const consoleMethod = type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log';
      console[consoleMethod](`[AI阅卷日志] ${message}`);
    };

    logToggle.addEventListener('click', () => {
      logShow = !logShow;
      if (logShow) {
        logContainer.classList.add('show');
        logToggle.textContent = '📋 隐藏日志';
      } else {
        logContainer.classList.remove('show');
        logToggle.textContent = '📋 显示日志';
      }
    });

    document.getElementById('ai-start-btn').onclick = () => startGrading();
    document.getElementById('ai-auto-check').onchange = (e) => {
      config.autoGrading = e.target.checked;
    };

    // 零分题列表功能
    const zeroScoreBtn = document.getElementById('ai-zero-score-btn');
    const zeroScoreListEl = document.getElementById('ai-zero-score-list');
    const zeroScoreStats = document.getElementById('ai-zero-score-stats');
    let zeroScoreListShow = false;

    // 更新零分题列表显示
    window.updateZeroScoreList = function(list) {
      zeroScoreListEl.innerHTML = '';
      
      if (list.length === 0) {
        zeroScoreListEl.innerHTML = '<div style="padding: 8px; text-align: center; opacity: 0.7;">暂无零分题</div>';
        zeroScoreStats.textContent = '';
        return;
      }

      zeroScoreStats.textContent = `共 ${list.length} 道零分题`;
      
      list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'zero-score-item';
        div.innerHTML = `
          <div class="zero-score-item-info">
            题号 ${item.index}
            <span class="zero-score-item-count">回评 ${item.reviewCount} 次</span>
          </div>
        `;
        div.addEventListener('click', () => {
          jumpToTaskAndRecord(item.index, item.id);
        });
        zeroScoreListEl.appendChild(div);
      });
    };

    // 提取零分题列表
    function extractZeroScoreList() {
      console.log('[extractZeroScoreList] 函数被调用');
      console.log('[extractZeroScoreList] currentAdapter:', currentAdapter);
      console.log('[extractZeroScoreList] currentAdapter.extractZeroScoreList:', typeof currentAdapter?.extractZeroScoreList);
      
      if (!currentAdapter || typeof currentAdapter.extractZeroScoreList !== 'function') {
        console.log('[extractZeroScoreList] ❌ 适配器不支持零分题提取');
        updateStatus('当前适配器不支持零分题提取', 'error');
        if (typeof window.addLog === 'function') {
          window.addLog('当前适配器不支持零分题提取功能', 'error');
        }
        return;
      }

      console.log('[extractZeroScoreList] ✅ 开始提取');
      updateStatus('正在提取零分题...', 'loading');
      
      // 在页面上下文中执行（绕过 content script 隔离）
      console.log('[extractZeroScoreList] 调用适配器方法...');
      currentAdapter.extractZeroScoreList(reviewHistory).then(list => {
        console.log('[extractZeroScoreList] ✅ 收到结果，数量:', list.length);
        zeroScoreList = list; // 更新全局变量
        window.updateZeroScoreList(list);
        
        if (typeof window.addLog === 'function') {
          window.addLog(`提取完成，找到 ${list.length} 道零分题`, list.length > 0 ? 'success' : 'info');
        }
        
        if (list.length > 0) {
          zeroScoreListEl.classList.add('show');
          zeroScoreBtn.textContent = '📋 隐藏零分题列表';
          zeroScoreListShow = true;
          updateStatus(`找到 ${list.length} 道零分题`, 'success');
        } else {
          zeroScoreListEl.classList.remove('show');
          zeroScoreBtn.textContent = '📋 显示零分题列表';
          zeroScoreListShow = false;
          updateStatus('没有零分题', 'info');
        }
      }).catch(error => {
        console.error('[AI阅卷] 提取零分题失败:', error);
        updateStatus('提取零分题失败: ' + error.message, 'error');
        if (typeof window.addLog === 'function') {
          window.addLog(`错误详情: ${error.message}`, 'error');
        }
      });
    }

    // 跳转到指定题目并记录
    function jumpToTaskAndRecord(index, id) {
      if (!currentAdapter || typeof currentAdapter.jumpToTask !== 'function') {
        updateStatus('当前适配器不支持跳转功能', 'error');
        return;
      }

      console.log('[jumpToTaskAndRecord] 开始跳转，index:', index, 'id:', id);
      updateStatus('正在跳转...', 'loading');
      
      // jumpToTask 现在返回 Promise
      const result = currentAdapter.jumpToTask(index - 1, id);
      
      // 处理 Promise 结果
      if (result && typeof result.then === 'function') {
        result.then(success => {
          if (success) {
            recordReview(index);
            updateStatus(`跳转到题号 ${index}`, 'info');
            console.log('[jumpToTaskAndRecord] ✅ 跳转成功');
          } else {
            updateStatus('跳转失败', 'error');
            console.log('[jumpToTaskAndRecord] ❌ 跳转失败');
          }
        }).catch(error => {
          console.error('[jumpToTaskAndRecord] ❌ 跳转出错:', error);
          updateStatus('跳转失败', 'error');
        });
      } else {
        // 兼容同步返回
        if (result) {
          recordReview(index);
          updateStatus(`跳转到题号 ${index}`, 'info');
        } else {
          updateStatus('跳转失败', 'error');
        }
      }
    }

    // 记录回评
    function recordReview(index) {
      reviewHistory[index] = (reviewHistory[index] || 0) + 1;
      
      // 更新列表中的对应项
      const item = zeroScoreList.find(item => item.index === index);
      if (item) {
        item.reviewCount = reviewHistory[index];
        window.updateZeroScoreList(zeroScoreList);
      }
    }

    // 切换零分题列表显示
    zeroScoreBtn.addEventListener('click', (e) => {
      if (zeroScoreListShow) {
        zeroScoreListEl.classList.remove('show');
        zeroScoreBtn.textContent = '📋 显示零分题列表';
        zeroScoreListShow = false;
      } else {
        extractZeroScoreList();
      }
    });

    // 满分题列表功能
    const fullScoreBtn = document.getElementById('ai-full-score-btn');
    const fullScoreListEl = document.getElementById('ai-full-score-list');
    const fullScoreStats = document.getElementById('ai-full-score-stats');
    let fullScoreListShow = false;

    // 更新满分题列表显示
    window.updateFullScoreList = function(list) {
      fullScoreListEl.innerHTML = '';
      
      if (list.length === 0) {
        fullScoreListEl.innerHTML = '<div style="padding: 8px; text-align: center; opacity: 0.7;">暂无满分题</div>';
        fullScoreStats.textContent = '';
        return;
      }

      fullScoreStats.textContent = `共 ${list.length} 道满分题`;
      
      list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'zero-score-item';
        div.innerHTML = `
          <div class="zero-score-item-info">
            题号 ${item.index} (${item.score}${item.maxScore ? '/' + item.maxScore : ''}分)
            <span class="zero-score-item-count">回评 ${item.reviewCount} 次</span>
          </div>
        `;
        div.addEventListener('click', () => {
          jumpToTaskAndRecord(item.index - 1, item.id);
        });
        fullScoreListEl.appendChild(div);
      });
    };

    // 提取满分题列表
    async function extractFullScoreList() {
      if (!currentAdapter || typeof currentAdapter.extractFullScoreList !== 'function') {
        console.log('[extractFullScoreList] ❌ 适配器不支持满分题提取');
        updateStatus('当前适配器不支持满分题提取', 'error');
        if (typeof window.addLog === 'function') {
          window.addLog('当前适配器不支持满分题提取功能', 'error');
        }
        return;
      }

      try {
        updateStatus('正在提取满分题...', 'loading');
        if (typeof window.addLog === 'function') {
          window.addLog('开始提取满分题列表...', 'info');
        }

        // 获取回评历史
        const reviewHistory = window.reviewHistory || {};

        const list = await currentAdapter.extractFullScoreList(reviewHistory);
        
        if (typeof window.addLog === 'function') {
          window.addLog(`提取完成，找到 ${list.length} 道满分题`, list.length > 0 ? 'success' : 'info');
        }

        if (list.length > 0) {
          fullScoreListEl.classList.add('show');
          fullScoreBtn.textContent = '✅ 隐藏满分题列表';
          updateStatus(`找到 ${list.length} 道满分题`, 'success');
        } else {
          fullScoreListEl.classList.remove('show');
          fullScoreBtn.textContent = '✅ 显示满分题列表';
          updateStatus('没有满分题', 'info');
        }

        window.updateFullScoreList(list);
      } catch (error) {
        console.error('[AI阅卷] 提取满分题失败:', error);
        updateStatus('提取满分题失败: ' + error.message, 'error');
        if (typeof window.addLog === 'function') {
          window.addLog('提取满分题失败: ' + error.message, 'error');
        }
      }
    }

    // 切换满分题列表显示
    fullScoreBtn.addEventListener('click', (e) => {
      if (fullScoreListShow) {
        fullScoreListEl.classList.remove('show');
        fullScoreBtn.textContent = '✅ 显示满分题列表';
        fullScoreListShow = false;
      } else {
        extractFullScoreList();
        fullScoreListShow = true;
      }
    });
  }

  // 更新状态
  function updateStatus(text, type = 'info') {
    const el = document.getElementById('ai-status');
    if (!el) return;
    const icons = { info: 'ℹ️', success: '✅', error: '❌', loading: '⏳' };
    el.innerText = `${icons[type] || ''} ${text}`;
    
    // 同时记录到日志
    if (typeof window.addLog === 'function') {
      window.addLog(text, type);
    }
  }

  // 开始阅卷
  function startGrading() {
    if (config.isGrading) {
      console.log('[AI阅卷] 正在阅卷中...');
      return;
    }

    if (!currentAdapter) {
      updateStatus('不支持当前网站', 'error');
      return;
    }

    const imageUrls = currentAdapter.getAnswerImageUrls();
    
    if (imageUrls.length === 0) {
      updateStatus('未找到答题图片', 'error');
      if (config.autoGrading) {
        setTimeout(startGrading, 1000);
      }
      return;
    }

    config.isGrading = true;
    updateStatus('正在切换到 AI...', 'loading');
    
    if (typeof window.addLog === 'function') {
      window.addLog(`开始阅卷，找到 ${imageUrls.length} 张图片`, 'info');
    }

    // 禁用按钮
    const btn = document.getElementById('ai-start-btn');
    if (btn) btn.disabled = true;

    // 获取保存的配置
    chrome.storage.local.get(['gradingConfig', 'selectedAIPlatform', 'selectedMode'], (result) => {
      const mode = result.selectedMode || 'web';
      if (typeof window.addLog === 'function') {
        window.addLog(`当前模式: ${mode === 'api' ? 'API 模式' : '网页模式'}`, 'info');
      }
      // 如果用户还没配置过，给个默认空对象（与旧版本一致）
      const gradingConfig = result.gradingConfig || {
        subject: '通用',
        questionType: '通用',
        totalScore: 10,
        answers: [],
        gradingRules: '无'
      };

      // 发送请求到 background（使用与旧版本一致的消息类型）
      if (typeof window.addLog === 'function') {
        window.addLog(`发送请求到后台，图片数量: ${imageUrls.length}`, 'info');
        if (mode === 'api') {
          window.addLog(`API 平台: ${result.selectedAPIPlatform || '未设置'}`, 'info');
        } else {
          window.addLog(`AI 平台: ${result.selectedAIPlatform || 'kimi'}`, 'info');
        }
      }
      
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_AND_GRADE_REQUEST',
        imageUrls: imageUrls,
        config: gradingConfig,
        aiPlatform: result.selectedAIPlatform || 'kimi',
        gradingSite: currentAdapter.name
      });
    });
  }

  // 处理阅卷结果
  function handleGradeResult(result) {
    console.log('[AI阅卷] 收到评分结果:', result);
    
    // 详细日志
    if (typeof window.addLog === 'function') {
      window.addLog(`收到 API 返回结果`, 'info');
      window.addLog(`原始内容: ${result.details?.substring(0, 200) || '无'}`, 'info');
      window.addLog(`解析的分数: ${result.score}`, result.score === '?' ? 'warn' : 'success');
    }
    
    updateStatus(`AI 评分: ${result.score}分`, result.score === '?' ? 'warn' : 'success');

    // 启用按钮
    const btn = document.getElementById('ai-start-btn');
    if (btn) btn.disabled = false;

    // 检查分数是否有效（注意：0 可能是有效分数）
    if (!result.score || result.score === '?') {
      if (typeof window.addLog === 'function') {
        window.addLog(`警告: 分数解析失败`, 'error');
        window.addLog(`完整原始响应: ${result.details || '无'}`, 'error');
      }
      updateStatus('分数解析失败，请检查 API 返回', 'error');
      config.isGrading = false;
      return;
    }
    
    // 记录分数（包括 0）
    if (typeof window.addLog === 'function') {
      window.addLog(`分数: ${result.score} (${result.score === '0' ? '注意：分数为0，可能是有效评分' : '有效'})`, 
        result.score === '0' ? 'warn' : 'success');
    }

    // 在点击评分前保存当前图片地址（用于判断是否已跳转到下一题）
    const oldImages = JSON.stringify(currentAdapter.getAnswerImageUrls());
    
    if (typeof window.addLog === 'function') {
      window.addLog(`尝试填入分数: ${result.score}`, 'info');
    }
    
    const success = currentAdapter.fillScore(result.score);
    
    if (typeof window.addLog === 'function') {
      window.addLog(`填入分数${success ? '成功' : '失败'}`, success ? 'success' : 'error');
      if (!success) {
        window.addLog(`提示: 请检查页面是否有分数输入框或按钮`, 'warn');
      }
    }

    if (config.autoGrading && success) {
      updateStatus('等待自动跳转到下一题...', 'loading');
      setTimeout(() => {
        waitForNextQuestion(oldImages);
      }, 3000);
    } else {
      config.isGrading = false;
    }
  }

  // 处理错误
  function handleError(message) {
    if (typeof window.addLog === 'function') {
      window.addLog(`错误: ${message}`, 'error');
    }
    updateStatus(message, 'error');
    config.isGrading = false;
    config.autoGrading = false;
    
    const checkbox = document.getElementById('ai-auto-check');
    if (checkbox) checkbox.checked = false;
    
    const btn = document.getElementById('ai-start-btn');
    if (btn) btn.disabled = false;
  }

  // 等待自动跳转到下一题（通过对比图片地址变化判断）
  function waitForNextQuestion(oldImages) {
    updateStatus('检测下一题...', 'loading');

    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      const newImages = currentAdapter.getAnswerImageUrls();
      
      // 对比图片地址，如果不同说明已跳转到下一题
      if (newImages.length > 0 && JSON.stringify(newImages) !== oldImages) {
        clearInterval(interval);
        config.isGrading = false;
        startGrading();
      }
      
      if (checks > 20) {
        clearInterval(interval);
        config.isGrading = false;
        updateStatus('跳转超时', 'error');
        
        const btn = document.getElementById('ai-start-btn');
        if (btn) btn.disabled = false;
      }
    }, 1000);
  }

  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'GRADE_RESULT') {
      handleGradeResult(msg);
    }
    if (msg.type === 'ERROR') {
      handleError(msg.message);
    }
  });

  // 初始化
  function init() {
    currentAdapter = matchAdapter();
    
    if (currentAdapter) {
      console.log(`[AI阅卷] 匹配到适配器: ${currentAdapter.displayName}`);
      setTimeout(injectUI, 1500);
    } else {
      console.log('[AI阅卷] 未找到匹配的适配器');
    }
  }

  // 等待页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

