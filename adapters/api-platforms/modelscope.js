// adapters/api-platforms/modelscope.js
// ModelScope API 适配器

import APIPlatformAdapter from './base.js';

class ModelScopeAdapter extends APIPlatformAdapter {
  constructor() {
    super();
    this.name = 'modelscope';
    this.displayName = 'ModelScope';
    // ModelScope API 端点（根据实际 API 文档调整）
    this.apiEndpoint = 'https://api.modelscope.cn/api/v1/services/aigc/multimodal-generation/generation';
    this.requiredConfig = ['apiKey'];
  }

  /**
   * 构建 API 请求体
   */
  buildRequestBody(base64Images, prompt, config) {
    // ModelScope 的 API 格式可能不同，这里提供一个通用实现
    // 实际使用时需要根据 ModelScope 的 API 文档调整
    
    const input = {
      text: prompt,
      images: []
    };

    // 添加图片（ModelScope 可能需要 base64 或 URL）
    if (base64Images && base64Images.length > 0) {
      base64Images.forEach(base64 => {
        // 保留完整的 data URL 格式
        input.images.push(base64);
      });
    }

    return {
      input: input,
      parameters: {
        max_new_tokens: config.maxTokens || 500,
        temperature: config.temperature || 0.3
      }
    };
  }

  /**
   * 调用 ModelScope API
   */
  async callAPI(base64Images, prompt, config) {
    const requestBody = this.buildRequestBody(base64Images, prompt, config);
    
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        // ModelScope 可能还需要其他头部
        'X-DashScope-Async': 'enable' // 如果需要异步调用
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: '请求失败' } }));
      throw new Error(`ModelScope API 错误: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    // 提取回复内容（根据 ModelScope 实际响应格式调整）
    const content = data.output?.text || data.output?.choices?.[0]?.message?.content || data.text || '';
    
    return {
      content: content,
      raw: data
    };
  }
}

export default ModelScopeAdapter;

