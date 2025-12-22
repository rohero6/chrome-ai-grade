// content-scripts/ai-platform-loader.js
// AI 平台适配器加载器

(function() {
  'use strict';
  
  console.log('[AI阅卷] AI 平台加载器启动 v4.0');

  // 工具函数
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  
  function base64ToBlob(base64, mimeType = 'image/png') {
    try {
      const byteCharacters = atob(base64.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType });
    } catch (e) {
      console.error('Base64 转换失败:', e);
      return null;
    }
  }

  // 构建 Prompt（与旧版本保持一致）
  function buildPrompt(config) {
    const cfg = config || {};
    
    let answersPrompt = "";
    if (cfg.answers && cfg.answers.length > 0) {
      cfg.answers.forEach((ans, index) => {
        answersPrompt += `
【采分点 ${index + 1}】(分值: ${ans.score}分)
- 标准答案内容：${ans.content}
- 核心关键词：${ans.keywords ? ans.keywords : "无"}
`;
      });
    } else {
      answersPrompt = "无具体标准答案，请根据学科常识判断。";
    }

    return `
我需要你扮演阅卷老师。
【基本信息】：科目-${cfg.subject || '通用'} | 题型-${cfg.questionType || '通用'} | 本题满分-${cfg.totalScore || 10}分。

【参考答案与采分点】：
${answersPrompt}

【整体评分规则】：
${cfg.gradingRules ? cfg.gradingRules : "请根据答案匹配度酌情给分。"}

【任务要求】：
请根据学生作答图片（已粘贴），结合上述采分点和关键词进行打分。
**重要：请严格按照标准，只返回一个最终分数的数字（例如：4），不要输出任何解释或多余文字。**
`;
  }

  // AI 平台适配器
  const adapters = {
    kimi: {
      name: 'kimi',
      displayName: 'Kimi (月之暗面)',
      matchPatterns: ['kimi.com', 'kimi.moonshot.cn'],
      
      getInputEditor() {
        // 兼容多种 Kimi 页面结构
        return document.querySelector('[contenteditable="true"]') ||
               document.querySelector('.chat-input [contenteditable]') ||
               document.querySelector('div[class*="editor"]') ||
               document.querySelector('div[class*="input"]');
      },
      
      async pasteImages(base64Images) {
        const editor = this.getInputEditor();
        if (!editor) throw new Error('未找到 Kimi 输入框');
        
        editor.focus();
        await sleep(300);
        
        for (let i = 0; i < base64Images.length; i++) {
          const blob = base64ToBlob(base64Images[i]);
          if (!blob) {
            console.warn(`[Kimi] 图片 ${i + 1} 转换失败，跳过`);
            continue;
          }
          
          const file = new File([blob], `image_${i}.png`, { type: 'image/png' });
          const dt = new DataTransfer();
          dt.items.add(file);
          
          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
          });
          
          editor.dispatchEvent(pasteEvent);
          console.log(`[Kimi] 粘贴图片 ${i + 1}/${base64Images.length}`);
          await sleep(1000); // 等待图片上传
        }
        return true;
      },
      
      async inputText(text) {
        const editor = this.getInputEditor();
        if (!editor) throw new Error('未找到 Kimi 输入框');
        
        editor.focus();
        await sleep(200);
        
        // 使用 execCommand 插入文本
        document.execCommand('insertText', false, text);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        
        return true;
      },
      
      getSendButton() {
        // 兼容多种按钮选择器
        return document.querySelector('[data-testid="send-button"]') ||
               document.querySelector('button[class*="send"]') ||
               document.querySelector('.send-button') ||
               document.querySelector('button[aria-label*="发送"]');
      },
      
      async clickSend() {
        console.log('[Kimi] 尝试发送...');
        const maxAttempts = 60; // 30秒超时
        const editor = this.getInputEditor();
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const btn = this.getSendButton();
          if (btn) {
            const style = window.getComputedStyle(btn);
            const isDisabled = btn.disabled || 
                              btn.classList.contains('disabled') ||
                              style.pointerEvents === 'none' ||
                              parseFloat(style.opacity) < 0.5;
            
            if (!isDisabled) {
              btn.click();
              await sleep(100);
              btn.click(); // 双击确保
              await sleep(800);
              
              // 检查是否清空（发送成功的标志）
              const editorText = editor?.innerText?.replace(/\s/g, '') || '';
              const hasImages = editor?.querySelector('img');
              
              if (editorText.length < 5 && !hasImages) {
                console.log('[Kimi] ✅ 发送成功');
                return true;
              }
            }
          }
          await sleep(500);
        }
        console.warn('[Kimi] 发送超时');
        return false;
      },
      
      getResponseBubbles() {
        // 使用与旧版本相同的选择器
        return document.querySelectorAll('div[class*="markdown"]');
      },
      
      getLatestResponse() {
        const bubbles = this.getResponseBubbles();
        return bubbles.length > 0 ? bubbles[bubbles.length - 1].innerText : '';
      },
      
      async waitForResponse(initialCount, timeoutMs = 60000) {
        console.log('[Kimi] ⏳ 等待 AI 回复...');
        const startTime = Date.now();
        let stableCount = 0;
        let lastTextLength = 0;
        let checkCount = 0;
        
        while (Date.now() - startTime < timeoutMs) {
          checkCount++;
          const bubbles = this.getResponseBubbles();
          
          if (bubbles.length <= initialCount) {
            if (checkCount > 60) {
              throw new Error('AI 回复超时');
            }
            await sleep(1000);
            continue;
          }
          
          const text = bubbles[bubbles.length - 1].innerText;
          if (!text) {
            await sleep(1000);
            continue;
          }
          
          // 等待内容稳定（与旧版本逻辑一致）
          if (text.length > 0 && text.length === lastTextLength) {
            stableCount++;
            if (stableCount >= 2) { // 连续2次检查内容不变
              console.log('[Kimi] AI 回复完成');
              return text;
            }
          } else {
            stableCount = 0;
          }
          
          lastTextLength = text.length;
          await sleep(1000);
        }
        
        throw new Error('等待 AI 回复超时');
      }
    },
    
    doubao: {
      name: 'doubao',
      displayName: '豆包 (字节跳动)',
      matchPatterns: ['doubao.com'],
      
      getInputEditor() {
        return document.querySelector('[contenteditable="true"]') ||
               document.querySelector('textarea');
      },
      
      async pasteImages(base64Images) {
        const editor = this.getInputEditor();
        if (!editor) throw new Error('未找到豆包输入框');
        
        editor.focus();
        await sleep(200);
        
        for (let i = 0; i < base64Images.length; i++) {
          const blob = base64ToBlob(base64Images[i]);
          const file = new File([blob], `image_${i}.png`, { type: 'image/png' });
          const dt = new DataTransfer();
          dt.items.add(file);
          
          editor.dispatchEvent(new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
          }));
          
          await sleep(800);
        }
        return true;
      },
      
      async inputText(text) {
        const editor = this.getInputEditor();
        if (!editor) throw new Error('未找到豆包输入框');
        
        editor.focus();
        await sleep(100);
        
        if (editor.tagName === 'TEXTAREA') {
          editor.value = text;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          document.execCommand('insertText', false, text);
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return true;
      },
      
      getSendButton() {
        return document.querySelector('[data-testid="send-button"]') ||
               document.querySelector('button[class*="send"]');
      },
      
      async clickSend() {
        const maxAttempts = 60;
        const editor = this.getInputEditor();
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const btn = this.getSendButton();
          if (btn && !btn.disabled) {
            btn.click();
            await sleep(800);
            
            const content = editor?.value || editor?.innerText || '';
            if (content.replace(/\s/g, '').length < 5) {
              return true;
            }
          }
          await sleep(500);
        }
        return false;
      },
      
      getResponseBubbles() {
        return document.querySelectorAll('[class*="message-content"], [class*="markdown"]');
      },
      
      getLatestResponse() {
        const bubbles = this.getResponseBubbles();
        return bubbles.length > 0 ? bubbles[bubbles.length - 1].innerText : '';
      },
      
      async waitForResponse(initialCount, timeoutMs = 60000) {
        const startTime = Date.now();
        let stableCount = 0;
        let lastTextLength = 0;
        
        while (Date.now() - startTime < timeoutMs) {
          const bubbles = this.getResponseBubbles();
          
          if (bubbles.length <= initialCount) {
            await sleep(500);
            continue;
          }
          
          const text = this.getLatestResponse();
          
          if (text.length > 0 && text.length === lastTextLength) {
            stableCount++;
            if (stableCount >= 3) return text;
          } else {
            stableCount = 0;
          }
          
          lastTextLength = text.length;
          await sleep(1000);
        }
        
        throw new Error('等待 AI 回复超时');
      }
    },
    
    deepseek: {
      name: 'deepseek',
      displayName: 'DeepSeek',
      matchPatterns: ['deepseek.com'],
      
      getInputEditor() {
        return document.querySelector('textarea') ||
               document.querySelector('[contenteditable="true"]');
      },
      
      async pasteImages(base64Images) {
        const editor = this.getInputEditor();
        if (!editor) throw new Error('未找到 DeepSeek 输入框');
        
        editor.focus();
        await sleep(200);
        
        for (let i = 0; i < base64Images.length; i++) {
          const blob = base64ToBlob(base64Images[i]);
          const file = new File([blob], `image_${i}.png`, { type: 'image/png' });
          const dt = new DataTransfer();
          dt.items.add(file);
          
          editor.dispatchEvent(new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
          }));
          
          await sleep(800);
        }
        return true;
      },
      
      async inputText(text) {
        const editor = this.getInputEditor();
        if (!editor) throw new Error('未找到 DeepSeek 输入框');
        
        editor.focus();
        await sleep(100);
        
        if (editor.tagName === 'TEXTAREA') {
          editor.value = text;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          document.execCommand('insertText', false, text);
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return true;
      },
      
      getSendButton() {
        return document.querySelector('[data-testid="send-button"]') ||
               document.querySelector('button[class*="send"]');
      },
      
      async clickSend() {
        const maxAttempts = 60;
        const editor = this.getInputEditor();
        
        // 尝试 Enter 键发送
        const btn = this.getSendButton();
        if (!btn) {
          editor?.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            bubbles: true
          }));
          await sleep(800);
          return true;
        }
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (btn && !btn.disabled) {
            btn.click();
            await sleep(800);
            
            const content = editor?.value || editor?.innerText || '';
            if (content.replace(/\s/g, '').length < 5) {
              return true;
            }
          }
          await sleep(500);
        }
        return false;
      },
      
      getResponseBubbles() {
        return document.querySelectorAll('[class*="markdown"], [class*="message"]');
      },
      
      getLatestResponse() {
        const bubbles = this.getResponseBubbles();
        return bubbles.length > 0 ? bubbles[bubbles.length - 1].innerText : '';
      },
      
      async waitForResponse(initialCount, timeoutMs = 60000) {
        const startTime = Date.now();
        let stableCount = 0;
        let lastTextLength = 0;
        
        while (Date.now() - startTime < timeoutMs) {
          const bubbles = this.getResponseBubbles();
          
          if (bubbles.length <= initialCount) {
            await sleep(500);
            continue;
          }
          
          const text = this.getLatestResponse();
          
          if (text.length > 0 && text.length === lastTextLength) {
            stableCount++;
            if (stableCount >= 3) return text;
          } else {
            stableCount = 0;
          }
          
          lastTextLength = text.length;
          await sleep(1000);
        }
        
        throw new Error('等待 AI 回复超时');
      }
    }
  };

  // 匹配当前 AI 平台
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

  // 执行 AI 任务（与旧版本逻辑保持一致）
  async function executeTask(adapter, data) {
    console.log(`[${adapter.displayName}] 🚀 开始处理新题目...`);
    
    // 记录初始气泡数量
    const initialBubbleCount = adapter.getResponseBubbles().length;

    // 1. 粘贴图片
    if (data.imagesBase64 && data.imagesBase64.length > 0) {
      console.log(`[${adapter.displayName}] 粘贴 ${data.imagesBase64.length} 张图片...`);
      await adapter.pasteImages(data.imagesBase64);
      await sleep(800);
    }

    // 2. 构建并输入 Prompt（在 AI 页面构建，与旧版本一致）
    const promptText = buildPrompt(data.config);
    console.log(`[${adapter.displayName}] 输入 Prompt...`);
    await adapter.inputText(promptText);
    await sleep(500);

    // 3. 发送（闭环验证）
    const sendSuccess = await adapter.clickSend();
    
    if (!sendSuccess) {
      throw new Error('发送失败');
    }

    // 4. 等待 AI 回复
    const responseText = await adapter.waitForResponse(initialBubbleCount);

    // 5. 解析分数
    const scoreMatch = responseText.match(/(\d+)/);
    const score = scoreMatch ? scoreMatch[0] : '?';
    console.log(`[${adapter.displayName}] 解析得分: ${score}`);

    return {
      score: score,
      details: responseText
    };
  }

  // 当前适配器
  let currentAdapter = null;

  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'DO_AI_TASK') {
      if (!currentAdapter) {
        chrome.runtime.sendMessage({
          type: 'ERROR',
          message: '未找到匹配的 AI 平台适配器'
        });
        return;
      }

      // 异步执行任务
      executeTask(currentAdapter, request)
        .then(result => {
          // 使用与旧版本一致的消息类型
          chrome.runtime.sendMessage({
            type: 'AI_DONE_AND_SWITCH_BACK',
            score: result.score,
            details: result.details
          });
        })
        .catch(error => {
          console.error(`[${currentAdapter.displayName}] 任务执行失败:`, error);
          chrome.runtime.sendMessage({
            type: 'ERROR',
            message: error.message || '任务执行失败'
          });
        });
    }
  });

  // 初始化
  function init() {
    currentAdapter = matchAdapter();
    
    if (currentAdapter) {
      console.log(`[AI阅卷] 匹配到 AI 平台: ${currentAdapter.displayName}`);
    } else {
      console.log('[AI阅卷] 未找到匹配的 AI 平台适配器');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

