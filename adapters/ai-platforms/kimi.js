// adapters/ai-platforms/kimi.js
// Kimi AI 平台适配器

import AIPlatformAdapter from './base.js';

class KimiAdapter extends AIPlatformAdapter {
  constructor() {
    super();
    this.name = 'kimi';
    this.displayName = 'Kimi (月之暗面)';
    this.matchPatterns = [
      '*://kimi.com/*',
      '*://www.kimi.com/*',
      '*://kimi.moonshot.cn/*'
    ];
    this.capabilities = {
      supportsImage: true,
      supportsMultiImage: true,
      maxImages: 20,
      supportsPaste: true
    };
  }

  /**
   * 获取输入框元素
   */
  getInputEditor() {
    // Kimi 使用 contenteditable div 作为输入框
    const selectors = [
      '[contenteditable="true"]',
      '.chat-input [contenteditable]',
      '[data-testid="chat-input"]',
      '.editor-container [contenteditable]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    
    return null;
  }

  /**
   * 粘贴图片到输入框
   */
  async pasteImages(base64Images) {
    const editor = this.getInputEditor();
    if (!editor) {
      throw new Error('未找到 Kimi 输入框');
    }

    // 聚焦输入框
    editor.focus();
    await this.sleep(200);

    for (let i = 0; i < base64Images.length; i++) {
      const base64 = base64Images[i];
      
      // 转换为 Blob 和 File
      const blob = this.base64ToBlob(base64);
      const file = new File([blob], `image_${i}.png`, { type: 'image/png' });
      
      // 创建 DataTransfer 对象
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      // 模拟粘贴事件
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });
      
      editor.dispatchEvent(pasteEvent);
      console.log(`[Kimi] 粘贴图片 ${i + 1}/${base64Images.length}`);
      
      // 等待图片上传处理
      await this.sleep(800);
    }

    return true;
  }

  /**
   * 输入文本到输入框
   */
  async inputText(text) {
    const editor = this.getInputEditor();
    if (!editor) {
      throw new Error('未找到 Kimi 输入框');
    }

    editor.focus();
    await this.sleep(100);

    // 使用 execCommand 插入文本（保留已有内容如图片）
    document.execCommand('insertText', false, text);
    
    // 触发 input 事件确保框架响应
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    
    return true;
  }

  /**
   * 点击发送按钮
   */
  async clickSend() {
    // 尝试多种选择器
    const selectors = [
      '[data-testid="send-button"]',
      'button[class*="send"]',
      '.send-button',
      'button[aria-label*="发送"]',
      'button[aria-label*="Send"]',
      '.chat-input button[type="submit"]',
      // Kimi 特有选择器
      'button svg[class*="send"]',
    ];

    let sendButton = null;
    
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        // 如果是 svg，找到父级 button
        sendButton = el.closest('button') || el;
        break;
      }
    }

    // 如果还没找到，尝试通过按钮内容查找
    if (!sendButton) {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.innerText.includes('发送') || 
            btn.querySelector('svg') && btn.closest('.chat-input')) {
          sendButton = btn;
          break;
        }
      }
    }

    if (!sendButton) {
      console.warn('[Kimi] 未找到发送按钮');
      return false;
    }

    // 健壮发送：多次尝试
    const maxAttempts = 60; // 30 秒超时
    const editor = this.getInputEditor();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 检查按钮是否可用
      const style = window.getComputedStyle(sendButton);
      const isDisabled = sendButton.disabled || 
                        sendButton.classList.contains('disabled') ||
                        style.pointerEvents === 'none' ||
                        parseFloat(style.opacity) < 0.5;

      if (!isDisabled) {
        // 点击发送
        sendButton.click();
        await this.sleep(100);
        sendButton.click(); // 双击确保
        
        await this.sleep(800);
        
        // 检查输入框是否清空（发送成功的标志）
        const editorText = editor?.innerText?.replace(/\s/g, '') || '';
        const hasImages = editor?.querySelector('img');
        
        if (editorText.length < 5 && !hasImages) {
          console.log('[Kimi] 发送成功');
          return true;
        }
      }
      
      await this.sleep(500);
    }

    console.warn('[Kimi] 发送超时');
    return false;
  }

  /**
   * 获取回复气泡数量
   */
  getResponseBubbleCount() {
    const bubbles = document.querySelectorAll(
      '[class*="markdown"], ' +
      '[class*="message-content"], ' +
      '.chat-message-content'
    );
    return bubbles.length;
  }

  /**
   * 获取最新回复文本
   */
  getLatestResponseText() {
    const selectors = [
      '[class*="markdown"]',
      '[class*="message-content"]',
      '.chat-message-content',
      '[data-testid="message-content"]'
    ];

    for (const selector of selectors) {
      const bubbles = document.querySelectorAll(selector);
      if (bubbles.length > 0) {
        return bubbles[bubbles.length - 1].innerText || '';
      }
    }
    
    return '';
  }

  /**
   * 等待 AI 回复完成
   */
  async waitForResponse(timeoutMs = 60000) {
    const initialCount = this.getResponseBubbleCount();
    const startTime = Date.now();
    
    let stableCount = 0;
    let lastTextLength = 0;

    while (Date.now() - startTime < timeoutMs) {
      const currentCount = this.getResponseBubbleCount();
      
      // 等待新气泡出现
      if (currentCount <= initialCount) {
        await this.sleep(500);
        continue;
      }

      const responseText = this.getLatestResponseText();
      
      // 检查内容是否稳定（不再变化）
      if (responseText.length > 0 && responseText.length === lastTextLength) {
        stableCount++;
        
        // 连续 3 次检查内容不变，认为回复完成
        if (stableCount >= 3) {
          console.log('[Kimi] AI 回复完成');
          return responseText;
        }
      } else {
        stableCount = 0;
      }
      
      lastTextLength = responseText.length;
      await this.sleep(1000);
    }

    throw new Error('等待 AI 回复超时');
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.KimiAdapter = KimiAdapter;
}

export default KimiAdapter;

