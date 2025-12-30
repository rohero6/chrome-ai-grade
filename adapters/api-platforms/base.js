// adapters/api-platforms/base.js
// API 平台适配器基类

class APIPlatformAdapter {
  constructor() {
    // 适配器唯一名称
    this.name = 'base';
    
    // 显示名称
    this.displayName = '基础 API';
    
    // API 端点 URL
    this.apiEndpoint = '';
    
    // 需要的配置项
    this.requiredConfig = ['apiKey'];
  }

  /**
   * 验证配置是否完整
   * @param {Object} config 配置对象
   * @returns {boolean}
   */
  validateConfig(config) {
    for (const key of this.requiredConfig) {
      if (!config[key]) {
        throw new Error(`缺少必需的配置项: ${key}`);
      }
    }
    return true;
  }

  /**
   * 构建 API 请求体
   * @param {string[]} base64Images Base64 图片数组
   * @param {string} prompt 提示词
   * @param {Object} config API 配置
   * @returns {Object} 请求体
   */
  buildRequestBody(base64Images, prompt, config) {
    throw new Error(`[${this.name}] 需要实现 buildRequestBody() 方法`);
  }

  /**
   * 调用 API
   * @param {string[]} base64Images Base64 图片数组
   * @param {string} prompt 提示词
   * @param {Object} config API 配置（包含 apiKey 等）
   * @returns {Promise<{score: string, details: string}>}
   */
  async callAPI(base64Images, prompt, config) {
    throw new Error(`[${this.name}] 需要实现 callAPI() 方法`);
  }

  /**
   * 从 API 响应中解析分数
   * @param {Object} response API 响应对象
   * @returns {string|null} 分数
   */
  parseScoreFromResponse(response) {
    // 默认实现：优先解析 JSON 格式的分数
    try {
      const text = response.content || response.text || JSON.stringify(response);
      
      // 1. 优先尝试解析完整的 JSON 对象
      try {
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const jsonObj = JSON.parse(jsonMatch[0]);
          if (jsonObj.score !== undefined) {
            return String(jsonObj.score);
          }
          if (jsonObj.分数 !== undefined) {
            return String(jsonObj.分数);
          }
        }
      } catch (e) {
        // JSON 解析失败，继续其他方法
      }
      
      // 2. 尝试匹配 JSON 格式字符串：{"score": 4} 或 {"分数": 4}
      const jsonMatch = text.match(/\{[\s\S]*?"(?:score|分数)"\s*:\s*(\d+)[\s\S]*?\}/);
      if (jsonMatch) {
        return jsonMatch[1];
      }
      
      // 3. 尝试匹配纯数字（最后一行）
      const lines = text.trim().split('\n');
      const lastLine = lines[lines.length - 1].trim();
      if (/^\d+$/.test(lastLine)) {
        return lastLine;
      }
      
      // 4. 匹配 "X分" 或 "X 分" 格式
      const scoreMatch = text.match(/(\d+)\s*分/);
      if (scoreMatch) {
        return scoreMatch[1];
      }
      
      // 5. 匹配任意数字（作为兜底）
      const numMatch = text.match(/(\d+)/);
      return numMatch ? numMatch[1] : null;
    } catch (e) {
      console.error(`[${this.name}] 解析分数失败:`, e);
      return null;
    }
  }

  /**
   * 执行完整的 API 任务
   * @param {string[]} base64Images Base64 图片数组
   * @param {string} prompt 提示词
   * @param {Object} config API 配置
   * @returns {Promise<{score: string, details: string}>}
   */
  async executeTask(base64Images, prompt, config) {
    console.log(`[${this.name}] 开始执行 API 任务...`);
    console.log(`[${this.name}] 图片数量: ${base64Images?.length || 0}`);
    console.log(`[${this.name}] Prompt 长度: ${prompt?.length || 0}`);
    
    // 验证配置
    this.validateConfig(config);
    
    // 调用 API
    console.log(`[${this.name}] 正在调用 API...`);
    const response = await this.callAPI(base64Images, prompt, config);
    
    const rawContent = response.content || response.text || JSON.stringify(response);
    console.log(`[${this.name}] API 返回原始内容:`, rawContent.substring(0, 500));
    
    // 解析分数
    const score = this.parseScoreFromResponse(response);
    console.log(`[${this.name}] 解析得分: ${score}`);
    
    if (!score || score === '?') {
      console.warn(`[${this.name}] 分数解析失败，原始内容:`, rawContent);
    }
    
    return {
      score: score || '?',
      details: rawContent
    };
  }
}

// 导出
export default APIPlatformAdapter;

