// adapters/api-platforms/zhipu.js
// 智谱AI API 适配器

import APIPlatformAdapter from './base.js';

class ZhipuAdapter extends APIPlatformAdapter {
  constructor() {
    super();
    this.name = 'zhipu';
    this.displayName = '智谱AI (Zhipu)';
    this.apiEndpoint = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    this.requiredConfig = ['apiKey'];
  }

  /**
   * 构建 API 请求体（使用base64，智谱AI需要纯base64字符串）
   */
  buildRequestBody(base64Images, prompt, config) {
    const model = config.model || 'glm-4v-flash';
    
    // 如果有图片，使用多模态格式
    if (base64Images && base64Images.length > 0) {
      const content = [];
      
      // 先添加文本提示词
      content.push({
        type: 'text',
        text: prompt
      });
      
      // 然后添加图片（智谱AI需要纯base64，不要data URL前缀）
      base64Images.forEach(base64 => {
        // 提取纯base64字符串（去掉 data:image/xxx;base64, 前缀）
        let pureBase64 = base64;
        if (base64.includes(',')) {
          pureBase64 = base64.split(',')[1];
        }
        
        content.push({
          type: 'image_url',
          image_url: {
            url: pureBase64  // 智谱AI直接使用纯Base64字符串
          }
        });
      });
      
      const requestBody = {
        model: model,
        messages: [
          {
            role: 'user',
            content: content
          }
        ],
        temperature: config.temperature || 0.3,
        max_tokens: config.maxTokens || 2000,
        thinking: {
          type: 'enabled'  // 开启思考模式
        }
      };
      
      return requestBody;
    } else {
      // 纯文本消息
      return {
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: config.temperature || 0.3,
        max_tokens: config.maxTokens || 2000,
        thinking: {
          type: 'enabled'  // 开启思考模式
        }
      };
    }
  }

  /**
   * 调用智谱AI API（使用base64）
   */
  async callAPI(base64Images, prompt, config) {
    const requestBody = this.buildRequestBody(base64Images, prompt, config);
    
    console.log('[zhipu] 请求体:', JSON.stringify(requestBody, null, 2));
    
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
      console.error('[zhipu] API 错误响应:', errorText);
      let error;
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        error = { error: { message: errorText || '请求失败' } };
      }
      throw new Error(`智谱AI API 错误: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('[zhipu] API 完整响应:', JSON.stringify(data, null, 2));
    
    // 智谱AI的响应格式：data.choices[0].message.content
    let content = '';
    
    // 处理不同的响应格式
    if (data.choices && data.choices.length > 0) {
      const message = data.choices[0].message;
      if (message) {
        // 可能是字符串或数组
        if (typeof message.content === 'string') {
          content = message.content;
        } else if (Array.isArray(message.content)) {
          // 如果是数组，提取文本部分
          content = message.content
            .filter(item => item.type === 'text')
            .map(item => item.text || item.content || '')
            .join('\n');
        }
      }
    }
    
    // 如果没有找到内容，尝试其他字段
    if (!content) {
      content = data.content || data.text || JSON.stringify(data);
    }
    
    console.log('[zhipu] 提取的内容:', content);
    
    return {
      content: content,
      raw: data
    };
  }
  
  /**
   * 重写解析分数方法，处理智谱AI的特殊格式
   */
  parseScoreFromResponse(response) {
    try {
      const text = response.content || response.text || JSON.stringify(response);
      console.log('[zhipu] 解析分数，原始文本:', text);
      
      // 过滤掉智谱AI的特殊标记
      let cleanText = text.replace(/<\|[^|]+\|>/g, '').trim();
      
      // 如果过滤后为空，使用原始文本
      if (!cleanText) {
        cleanText = text;
      }
      
      // 1. 优先尝试解析完整的 JSON 对象（支持多行JSON）
      try {
        // 尝试匹配完整的JSON对象（可能跨多行）
        const jsonMatch = cleanText.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const jsonObj = JSON.parse(jsonMatch[0]);
          if (jsonObj.score !== undefined) {
            console.log('[zhipu] ✅ 从JSON中解析到分数:', jsonObj.score);
            return String(jsonObj.score);
          }
          if (jsonObj.分数 !== undefined) {
            console.log('[zhipu] ✅ 从JSON中解析到分数（中文键）:', jsonObj.分数);
            return String(jsonObj.分数);
          }
        }
      } catch (e) {
        console.log('[zhipu] JSON解析失败，尝试其他方法:', e.message);
      }
      
      // 2. 尝试匹配 JSON 格式字符串：{"score": 4} 或 {"分数": 4}
      const jsonMatch = cleanText.match(/\{[\s\S]*?"(?:score|分数)"\s*:\s*(\d+)[\s\S]*?\}/);
      if (jsonMatch) {
        console.log('[zhipu] ✅ 从JSON字符串中解析到分数:', jsonMatch[1]);
        return jsonMatch[1];
      }
      
      // 3. 尝试从评语中提取分数（如果AI返回了评语但没有JSON）
      // 匹配 "X分"、"X 分"、"分数：X"、"得分：X" 等格式
      const scorePatterns = [
        /(?:分数|得分|评分)[：:]\s*(\d+)/,
        /(\d+)\s*分/,
        /给[予]?\s*(\d+)\s*分/,
        /评[为]?\s*(\d+)\s*分/
      ];
      
      for (const pattern of scorePatterns) {
        const match = cleanText.match(pattern);
        if (match) {
          console.log('[zhipu] ✅ 从评语中提取到分数:', match[1]);
          return match[1];
        }
      }
      
      // 4. 尝试匹配纯数字（最后一行，可能是单独的数字）
      const lines = cleanText.trim().split('\n');
      const lastLine = lines[lines.length - 1].trim();
      if (/^\d+$/.test(lastLine)) {
        console.log('[zhipu] ✅ 从最后一行提取到数字:', lastLine);
        return lastLine;
      }
      
      // 5. 匹配任意数字（作为兜底，但优先选择合理的分数范围）
      const numMatches = cleanText.match(/\d+/g);
      if (numMatches && numMatches.length > 0) {
        // 选择第一个看起来像分数的数字（0-10之间，作为默认范围）
        for (const num of numMatches) {
          const score = parseInt(num);
          if (score >= 0 && score <= 10) {
            console.log('[zhipu] ⚠️ 从文本中提取到可能的分数:', score);
            return String(score);
          }
        }
        // 如果没找到合理范围的数字，返回第一个数字
        console.log('[zhipu] ⚠️ 使用第一个数字作为分数:', numMatches[0]);
        return numMatches[0];
      }
      
      console.warn('[zhipu] ❌ 无法解析分数');
      return null;
    } catch (e) {
      console.error(`[zhipu] 解析分数失败:`, e);
      return null;
    }
  }
}

export default ZhipuAdapter;

