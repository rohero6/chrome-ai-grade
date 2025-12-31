// adapters/api-platforms/modelscope.js
// ModelScope API 适配器

import APIPlatformAdapter from './base.js';

class ModelScopeAdapter extends APIPlatformAdapter {
  constructor() {
    super();
    this.name = 'modelscope';
    this.displayName = 'ModelScope';
    // ModelScope 使用 OpenAI 兼容的 API
    this.apiEndpoint = 'https://api-inference.modelscope.cn/v1/chat/completions';
    this.requiredConfig = ['apiKey'];
    
    // 限流相关：每分钟最多 50 次请求
    this.maxRequestsPerMinute = 50;
    this.requestTimestamps = []; // 记录最近一分钟内的请求时间戳
    this.minRequestInterval = 1200; // 最小请求间隔 1.2 秒（50次/分钟 = 1.2秒/次）
  }
  
  /**
   * 限流：确保不超过每分钟 50 次请求
   */
  async waitForRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000; // 60秒前
    
    // 清理一分钟前的请求记录
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > oneMinuteAgo);
    
    // 如果当前分钟内的请求数已达到限制
    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      // 计算需要等待的时间（等待最早的请求超过1分钟）
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = 60000 - (now - oldestRequest) + 100; // 多等100ms确保安全
      console.log(`[modelscope] 达到限流上限（${this.maxRequestsPerMinute}次/分钟），等待 ${Math.ceil(waitTime / 1000)} 秒`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // 重新清理
      const newNow = Date.now();
      const newOneMinuteAgo = newNow - 60000;
      this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > newOneMinuteAgo);
    }
    
    // 确保最小请求间隔
    if (this.requestTimestamps.length > 0) {
      const lastRequest = this.requestTimestamps[this.requestTimestamps.length - 1];
      const timeSinceLastRequest = now - lastRequest;
      
      if (timeSinceLastRequest < this.minRequestInterval) {
        const waitTime = this.minRequestInterval - timeSinceLastRequest;
        console.log(`[modelscope] 请求间隔过短，等待 ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // 记录本次请求时间
    this.requestTimestamps.push(Date.now());
    console.log(`[modelscope] 当前分钟请求数: ${this.requestTimestamps.length}/${this.maxRequestsPerMinute}`);
  }

  /**
   * 构建 API 请求体（OpenAI 兼容格式）
   */
  buildRequestBody(base64Images, prompt, config) {
    const model = config.model || 'qwen-vl-max';
    
    const messages = [
      {
        role: 'user',
        content: []
      }
    ];

    // 添加文本提示词
    messages[0].content.push({
      type: 'text',
      text: prompt
    });

    // 添加图片（ModelScope 支持 base64 或 URL）
    if (base64Images && base64Images.length > 0) {
      base64Images.forEach(base64 => {
        // ModelScope 支持完整的 data URL 格式
        const base64Data = base64.includes(',') ? base64 : `data:image/png;base64,${base64}`;
        messages[0].content.push({
          type: 'image_url',
          image_url: {
            url: base64Data
          }
        });
      });
    }

    return {
      model: model,
      messages: messages,
      max_tokens: config.maxTokens || 500,
      temperature: config.temperature || 0.3,
      stream: false  // 非流式响应
    };
  }

  /**
   * 调用 ModelScope API（带限流和重试）
   */
  async callAPI(base64Images, prompt, config, retryCount = 0) {
    // 限流：确保请求间隔
    await this.waitForRateLimit();
    
    const requestBody = this.buildRequestBody(base64Images, prompt, config);
    
    console.log('[modelscope] 请求体:', JSON.stringify(requestBody, null, 2));
    console.log('[modelscope] API端点:', this.apiEndpoint);
    
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[modelscope] API 错误响应:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch (e) {
          error = { error: { message: errorText || '请求失败' } };
        }
        
        const errorMessage = error.error?.message || response.statusText;
        
        // 处理限流错误：429 Too Many Requests
        if (response.status === 429 || errorMessage.includes('Too Many Requests')) {
          if (retryCount < 3) {
            // 指数退避：2秒、4秒、8秒
            const backoffTime = Math.pow(2, retryCount) * 2000;
            console.log(`[modelscope] 遇到限流，${backoffTime}ms 后重试 (${retryCount + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            return this.callAPI(base64Images, prompt, config, retryCount + 1);
          } else {
            throw new Error(`ModelScope API 限流: 请求过于频繁，请稍后再试`);
          }
        }
        
        throw new Error(`ModelScope API 错误: ${errorMessage}`);
      }

      const data = await response.json();
      console.log('[modelscope] API 完整响应:', JSON.stringify(data, null, 2));
      
      // 提取回复内容（OpenAI 兼容格式）
      const content = data.choices?.[0]?.message?.content || data.output?.text || data.text || '';
      
      return {
        content: content,
        raw: data
      };
    } catch (error) {
      // 处理网络错误
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        console.error('[modelscope] 网络请求失败:', error);
        throw new Error(`ModelScope API 网络错误: 请检查网络连接和API端点是否正确。端点: ${this.apiEndpoint}`);
      }
      throw error;
    }
  }
}

export default ModelScopeAdapter;

