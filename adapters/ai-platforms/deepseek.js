// adapters/ai-platforms/deepseek.js
// DeepSeek AI 平台适配器

import AIPlatformAdapter from './base.js';

class DeepSeekAdapter extends AIPlatformAdapter {
  constructor() {
    super();
    this.name = 'deepseek';
    this.displayName = 'DeepSeek';
    this.matchPatterns = [
      '*://chat.deepseek.com/*',
      '*://www.deepseek.com/*'
    ];
    this.capabilities = {
      supportsImage: true,
      supportsMultiImage: true,
      maxImages: 10,
      supportsPaste: true
    };
  }

  /**
   * 获取输入框元素
   */
  getInputEditor() {
    const selectors = [
      'textarea',
      '[contenteditable="true"]',
      '#chat-input',
      '[data-testid="chat-input"]'
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
      throw new Error('未找到 DeepSeek 输入框');
    }

    editor.focus();
    await this.sleep(200);

    for (let i = 0; i < base64Images.length; i++) {
      const base64 = base64Images[i];
      const blob = this.base64ToBlob(base64);
      const file = new File([blob], `image_${i}.png`, { type: 'image/png' });
      
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });
      
      editor.dispatchEvent(pasteEvent);
      console.log(`[DeepSeek] 粘贴图片 ${i + 1}/${base64Images.length}`);
      
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
      throw new Error('未找到 DeepSeek 输入框');
    }

    editor.focus();
    await this.sleep(100);

    if (editor.tagName === 'TEXTAREA') {
      editor.value = text;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      document.execCommand('insertText', false, text);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    return true;
  }

  /**
   * 点击发送按钮
   */
  async clickSend() {
    const selectors = [
      '[data-testid="send-button"]',
      'button[class*="send"]',
      '.send-button',
      'button[aria-label*="发送"]',
      'button[aria-label*="Send"]',
      // DeepSeek 可能的选择器
      '.chat-input-actions button',
      'button svg[class*="send"]'
    ];

    let sendButton = null;
    
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        sendButton = el.closest('button') || el;
        break;
      }
    }

    // 通过 Enter 键发送
    if (!sendButton) {
      const editor = this.getInputEditor();
      if (editor) {
        editor.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true
        }));
        await this.sleep(800);
        
        const editorContent = editor.value || editor.innerText || '';
        if (editorContent.replace(/\s/g, '').length < 5) {
          console.log('[DeepSeek] 通过 Enter 键发送成功');
          return true;
        }
      }
    }

    if (!sendButton) {
      console.warn('[DeepSeek] 未找到发送按钮');
      return false;
    }

    // 健壮发送
    const maxAttempts = 60;
    const editor = this.getInputEditor();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const style = window.getComputedStyle(sendButton);
      const isDisabled = sendButton.disabled || 
                        parseFloat(style.opacity) < 0.5;

      if (!isDisabled) {
        sendButton.click();
        await this.sleep(800);
        
        const editorContent = editor?.value || editor?.innerText || '';
        if (editorContent.replace(/\s/g, '').length < 5) {
          console.log('[DeepSeek] 发送成功');
          return true;
        }
      }
      
      await this.sleep(500);
    }

    return false;
  }

  /**
   * 获取回复气泡数量
   */
  getResponseBubbleCount() {
    const bubbles = document.querySelectorAll(
      '[class*="message"], ' +
      '[class*="markdown"], ' +
      '.chat-message'
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
      '.chat-message'
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
      
      if (currentCount <= initialCount) {
        await this.sleep(500);
        continue;
      }

      const responseText = this.getLatestResponseText();
      
      if (responseText.length > 0 && responseText.length === lastTextLength) {
        stableCount++;
        if (stableCount >= 3) {
          console.log('[DeepSeek] AI 回复完成');
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
  window.DeepSeekAdapter = DeepSeekAdapter;
}

export default DeepSeekAdapter;

