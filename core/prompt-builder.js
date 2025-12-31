// core/prompt-builder.js
// Prompt 构造器

class PromptBuilder {
  constructor(config = {}) {
    this.config = config;
  }

  // 设置配置
  setConfig(config) {
    this.config = config;
    return this;
  }

  // 构建完整的阅卷 Prompt
  build() {
    const cfg = this.config;
    
    // 1. 构建答案采分点部分
    let answersSection = this._buildAnswersSection(cfg.answers);
    
    // 2. 构建完整 Prompt
    const prompt = `
我需要你扮演一位专业的阅卷老师。

【基本信息】
- 科目：${cfg.subject || '通用'}
- 题型：${cfg.questionType || '通用'}
- 本题满分：${cfg.totalScore || 10}分

【参考答案与采分点】
${answersSection}

【评分规则】
${cfg.gradingRules || '请根据答案匹配度酌情给分。'}

【任务要求】
请根据学生作答图片（已上传），结合上述采分点和关键词进行评分。

**重要提示**：
1. 仔细分析学生答案与标准答案的匹配程度
2. 按照采分点逐项评分
3. **最终只返回一个分数数字（如：4），不要输出任何解释文字**
`.trim();

    return prompt;
  }

  // 构建简洁版 Prompt（用于不支持长文本的 AI）
  buildCompact() {
    const cfg = this.config;
    
    let keyPoints = '';
    if (cfg.answers && cfg.answers.length > 0) {
      keyPoints = cfg.answers.map((ans, i) => 
        `${i + 1}. ${ans.content}(${ans.score}分)`
      ).join('；');
    }

    return `阅卷任务：${cfg.subject}${cfg.questionType}，满分${cfg.totalScore}分。答案要点：${keyPoints}。请根据图片中学生答案打分，只返回分数数字。`;
  }

  // 构建 API 模式 Prompt（强制返回 JSON 格式）
  buildForAPI() {
    const cfg = this.config;
    
    // 1. 构建答案采分点部分
    let answersSection = this._buildAnswersSection(cfg.answers);
    
    // 2. 构建完整 Prompt，强制 JSON 格式返回
    const prompt = `
你是一位专业的阅卷老师。请根据学生作答图片进行评分。

【基本信息】
- 科目：${cfg.subject || '通用'}
- 题型：${cfg.questionType || '通用'}
- 本题满分：${cfg.totalScore || 10}分

【参考答案与采分点】
${answersSection}

【评分规则】
${cfg.gradingRules || '请根据答案匹配度酌情给分。'}

【任务要求】
1. 仔细分析学生答案与标准答案的匹配程度
2. 按照采分点逐项评分
3. 给出最终分数（0-${cfg.totalScore || 10}分之间的整数）

【输出格式要求 - 必须严格遵守】
你必须只返回一个有效的JSON对象，格式如下：
{"score": 数字}

示例：
- 如果评分为 4 分，返回：{"score": 4}
- 如果评分为 0 分，返回：{"score": 0}
- 如果评分为满分 ${cfg.totalScore || 10} 分，返回：{"score": ${cfg.totalScore || 10}}

**重要：只返回JSON，不要输出任何其他文字、解释或评语！**
`.trim();

    return prompt;
  }

  // 构建答案部分
  _buildAnswersSection(answers) {
    if (!answers || answers.length === 0) {
      return '无具体标准答案，请根据学科常识判断。';
    }

    return answers.map((ans, index) => `
【采分点 ${index + 1}】(分值: ${ans.score}分)
- 标准答案：${ans.content || '无'}
- 核心关键词：${ans.keywords || '无'}
`).join('\n');
  }

  // 静态方法：快速构建
  static create(config) {
    return new PromptBuilder(config).build();
  }

  static createCompact(config) {
    return new PromptBuilder(config).buildCompact();
  }

  static createForAPI(config) {
    return new PromptBuilder(config).buildForAPI();
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.PromptBuilder = PromptBuilder;
}

export default PromptBuilder;

