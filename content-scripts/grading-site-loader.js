// content-scripts/grading-site-loader.js
// 改卷网站适配器加载器

(function() {
  'use strict';
  
  console.log('[AI阅卷] 改卷网站加载器启动...');

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
        #ai-grading-panel .drag-hint {
          font-size: 10px;
          opacity: 0.6;
          text-align: center;
          margin-top: 8px;
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

    document.getElementById('ai-start-btn').onclick = () => startGrading();
    document.getElementById('ai-auto-check').onchange = (e) => {
      config.autoGrading = e.target.checked;
    };
  }

  // 更新状态
  function updateStatus(text, type = 'info') {
    const el = document.getElementById('ai-status');
    if (!el) return;
    const icons = { info: 'ℹ️', success: '✅', error: '❌', loading: '⏳' };
    el.innerText = `${icons[type] || ''} ${text}`;
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

    // 禁用按钮
    const btn = document.getElementById('ai-start-btn');
    if (btn) btn.disabled = true;

    // 获取保存的配置
    chrome.storage.local.get(['gradingConfig', 'selectedAIPlatform'], (result) => {
      // 如果用户还没配置过，给个默认空对象（与旧版本一致）
      const gradingConfig = result.gradingConfig || {
        subject: '通用',
        questionType: '通用',
        totalScore: 10,
        answers: [],
        gradingRules: '无'
      };

      // 发送请求到 background（使用与旧版本一致的消息类型）
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
    console.log('[AI阅卷] 收到评分结果:', result.score);
    updateStatus(`AI 评分: ${result.score}分`, 'success');

    // 启用按钮
    const btn = document.getElementById('ai-start-btn');
    if (btn) btn.disabled = false;

    const success = currentAdapter.fillScore(result.score);

    if (config.autoGrading && success) {
      updateStatus('3秒后进入下一题...', 'loading');
      setTimeout(() => {
        goToNextAndContinue();
      }, 3000);
    } else {
      config.isGrading = false;
    }
  }

  // 处理错误
  function handleError(message) {
    updateStatus(message, 'error');
    config.isGrading = false;
    config.autoGrading = false;
    
    const checkbox = document.getElementById('ai-auto-check');
    if (checkbox) checkbox.checked = false;
    
    const btn = document.getElementById('ai-start-btn');
    if (btn) btn.disabled = false;
  }

  // 跳转下一题并继续
  function goToNextAndContinue() {
    const oldImages = JSON.stringify(currentAdapter.getAnswerImageUrls());
    currentAdapter.goToNext();
    updateStatus('加载下一题...', 'loading');

    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      const newImages = currentAdapter.getAnswerImageUrls();
      
      if (newImages.length > 0 && JSON.stringify(newImages) !== oldImages) {
        clearInterval(interval);
        config.isGrading = false;
        startGrading();
      }
      
      if (checks > 20) {
        clearInterval(interval);
        config.isGrading = false;
        updateStatus('翻页超时', 'error');
        
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

