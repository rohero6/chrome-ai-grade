// adapters/ai-platforms/base.js
// AI 平台适配器基类

class AIPlatformAdapter {
  constructor() {
    // 适配器唯一名称
    this.name = 'base';
    
    // 显示名称
    this.displayName = '基础 AI';
    
    // URL 匹配模式
    this.matchPatterns = [];
    
    // 功能支持
    this.capabilities = {
      supportsImage: true,      // 是否支持图片上传
      supportsMultiImage: true, // 是否支持多图
      maxImages: 10,            // 最大图片数
      supportsPaste: true       // 是否支持粘贴
    };
  }

  // ============ 必须实现的方法 ============

  /**
   * 获取输入框元素
   * @returns {HTMLElement|null}
   */
  getInputEditor() {
    throw new Error(`[${this.name}] 需要实现 getInputEditor() 方法`);
  }

  /**
   * 粘贴图片到输入框
   * @param {string[]} base64Images Base64 图片数组
   * @returns {Promise<boolean>}
   */
  async pasteImages(base64Images) {
    throw new Error(`[${this.name}] 需要实现 pasteImages() 方法`);
  }

  /**
   * 输入文本到输入框
   * @param {string} text 文本内容
   * @returns {Promise<boolean>}
   */
  async inputText(text) {
    throw new Error(`[${this.name}] 需要实现 inputText() 方法`);
  }

  /**
   * 点击发送按钮
   * @returns {Promise<boolean>}
   */
  async clickSend() {
    throw new Error(`[${this.name}] 需要实现 clickSend() 方法`);
  }

  /**
   * 等待 AI 回复完成
   * @param {number} timeoutMs 超时时间
   * @returns {Promise<string>} 回复文本
   */
  async waitForResponse(timeoutMs = 60000) {
    throw new Error(`[${this.name}] 需要实现 waitForResponse() 方法`);
  }

  // ============ 通用工具方法 ============

  /**
   * 从回复中解析分数
   * @param {string} responseText AI 回复文本
   * @returns {string|null} 分数
   */
  parseScore(responseText) {
    // 尝试匹配纯数字
    const lines = responseText.trim().split('\n');
    
    // 优先检查最后一行是否是纯数字
    const lastLine = lines[lines.length - 1].trim();
    if (/^\d+$/.test(lastLine)) {
      return lastLine;
    }
    
    // 匹配 "X分" 或 "X 分" 格式
    const scoreMatch = responseText.match(/(\d+)\s*分/);
    if (scoreMatch) {
      return scoreMatch[1];
    }
    
    // 匹配任意数字
    const numMatch = responseText.match(/(\d+)/);
    return numMatch ? numMatch[1] : null;
  }

  /**
   * Base64 转 Blob
   * @param {string} base64 Base64 字符串
   * @param {string} mimeType MIME 类型
   * @returns {Blob}
   */
  base64ToBlob(base64, mimeType = 'image/png') {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * 睡眠/延时
   * @param {number} ms 毫秒
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 等待元素出现
   * @param {string} selector CSS 选择器
   * @param {number} timeout 超时时间
   * @returns {Promise<HTMLElement>}
   */
  async waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await this.sleep(200);
    }
    
    throw new Error(`等待元素超时: ${selector}`);
  }

  /**
   * 获取当前对话气泡数量
   * @returns {number}
   */
  getResponseBubbleCount() {
    // 子类可覆盖，默认实现
    const bubbles = document.querySelectorAll('[class*="message"], [class*="bubble"], [class*="markdown"]');
    return bubbles.length;
  }

  /**
   * 获取最新回复文本
   * @returns {string}
   */
  getLatestResponseText() {
    // 子类应覆盖此方法
    const bubbles = document.querySelectorAll('[class*="markdown"]');
    if (bubbles.length === 0) return '';
    return bubbles[bubbles.length - 1].innerText || '';
  }

  /**
   * 执行完整的 AI 任务
   * @param {string[]} base64Images 图片数组
   * @param {string} prompt 提示词
   * @returns {Promise<{score: string, details: string}>}
   */
  async executeTask(base64Images, prompt) {
    console.log(`[${this.name}] 开始执行 AI 任务...`);
    
    const initialBubbleCount = this.getResponseBubbleCount();

    // 1. 粘贴图片
    if (base64Images && base64Images.length > 0) {
      console.log(`[${this.name}] 粘贴 ${base64Images.length} 张图片...`);
      await this.pasteImages(base64Images);
      await this.sleep(500);
    }

    // 2. 输入文本
    console.log(`[${this.name}] 输入 Prompt...`);
    await this.inputText(prompt);
    await this.sleep(300);

    // 3. 发送
    console.log(`[${this.name}] 点击发送...`);
    const sendSuccess = await this.clickSend();
    
    if (!sendSuccess) {
      throw new Error('发送失败');
    }

    // 4. 等待回复
    console.log(`[${this.name}] 等待 AI 回复...`);
    const responseText = await this.waitForResponse();

    // 5. 解析分数
    const score = this.parseScore(responseText);
    console.log(`[${this.name}] 解析得分: ${score}`);

    return {
      score: score || '?',
      details: responseText
    };
  }

  /**
   * 初始化适配器
   */
  init() {
    console.log(`[${this.name}] AI 平台适配器初始化`);
    
    // 监听来自 background 的任务
    chrome.runtime.onMessage.addListener(async (request) => {
      if (request.type === 'DO_AI_TASK') {
        try {
          const result = await this.executeTask(request.imagesBase64, request.prompt);
          
          // 通知 background 完成
          chrome.runtime.sendMessage({
            type: 'AI_DONE',
            score: result.score,
            details: result.details
          });
        } catch (error) {
          console.error(`[${this.name}] 任务执行失败:`, error);
          chrome.runtime.sendMessage({
            type: 'ERROR',
            message: error.message || '任务执行失败'
          });
        }
      }
    });
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.AIPlatformAdapter = AIPlatformAdapter;
}

export default AIPlatformAdapter;

