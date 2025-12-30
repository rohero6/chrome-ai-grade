// adapters/api-platforms/gemini.js
// Google Gemini API 适配器

import APIPlatformAdapter from './base.js';

class GeminiAdapter extends APIPlatformAdapter {
  constructor() {
    super();
    this.name = 'gemini';
    this.displayName = 'Google Gemini';
    this.apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.requiredConfig = ['apiKey'];
  }

  /**
   * 构建 API 请求体
   */
  buildRequestBody(base64Images, prompt, config) {
    const contents = [{
      parts: []
    }];

    // 添加图片
    if (base64Images && base64Images.length > 0) {
      base64Images.forEach(base64 => {
        // Gemini 需要纯 base64（去掉 data:image/png;base64, 前缀）
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        contents[0].parts.push({
          inline_data: {
            mime_type: 'image/png',
            data: base64Data
          }
        });
      });
    }

    // 添加文本提示词
    contents[0].parts.push({
      text: prompt
    });

    return {
      contents: contents,
      generationConfig: {
        maxOutputTokens: config.maxTokens || 500,
        temperature: config.temperature || 0.3
      }
    };
  }

  /**
   * 调用 Gemini API
   */
  async callAPI(base64Images, prompt, config) {
    // 默认使用免费层支持的模型
    const model = config.model || 'gemini-1.5-flash';
    const url = `${this.apiEndpoint}/${model}:generateContent?key=${config.apiKey}`;
    
    const requestBody = this.buildRequestBody(base64Images, prompt, config);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: '请求失败' } }));
      
      // 提供更友好的错误信息
      let errorMessage = error.error?.message || response.statusText;
      
      // 如果是配额错误，提供更详细的提示
      if (errorMessage.includes('quota') || errorMessage.includes('Quota exceeded')) {
        errorMessage += '\n\n提示：免费层可能有配额限制，请检查您的 API 配额或尝试使用其他模型（如 gemini-1.5-flash）。';
      }
      
      throw new Error(`Gemini API 错误: ${errorMessage}`);
    }

    const data = await response.json();
    
    // 提取回复内容
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return {
      content: content,
      raw: data
    };
  }
}

export default GeminiAdapter;

