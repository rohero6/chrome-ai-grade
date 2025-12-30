// adapters/api-platforms/openai.js
// OpenAI API 适配器

import APIPlatformAdapter from './base.js';

class OpenAIAdapter extends APIPlatformAdapter {
  constructor() {
    super();
    this.name = 'openai';
    this.displayName = 'OpenAI';
    this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    this.requiredConfig = ['apiKey'];
  }

  /**
   * 构建 API 请求体
   */
  buildRequestBody(base64Images, prompt, config) {
    const messages = [
      {
        role: 'user',
        content: []
      }
    ];

    // 添加图片
    if (base64Images && base64Images.length > 0) {
      base64Images.forEach(base64 => {
        // OpenAI 需要 base64 格式（去掉 data:image/png;base64, 前缀）
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        messages[0].content.push({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${base64Data}`
          }
        });
      });
    }

    // 添加文本提示词
    messages[0].content.push({
      type: 'text',
      text: prompt
    });

    return {
      model: config.model || 'gpt-4o',
      messages: messages,
      max_tokens: config.maxTokens || 500,
      temperature: config.temperature || 0.3
    };
  }

  /**
   * 调用 OpenAI API
   */
  async callAPI(base64Images, prompt, config) {
    const requestBody = this.buildRequestBody(base64Images, prompt, config);
    
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: '请求失败' } }));
      throw new Error(`OpenAI API 错误: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    // 提取回复内容
    const content = data.choices?.[0]?.message?.content || '';
    
    return {
      content: content,
      raw: data
    };
  }
}

export default OpenAIAdapter;

