// adapters/grading-sites/base.js
// 改卷网站适配器基类

class GradingSiteAdapter {
  constructor() {
    // 适配器唯一名称
    this.name = 'base';
    
    // 显示名称
    this.displayName = '基础适配器';
    
    // URL 匹配模式（用于自动识别）
    this.matchPatterns = [];
    
    // 配置项
    this.config = {
      isGrading: false,
      autoGrading: false
    };
  }

  // ============ 必须实现的方法 ============

  /**
   * 检测页面是否准备就绪
   * @returns {boolean}
   */
  isReady() {
    throw new Error(`[${this.name}] 需要实现 isReady() 方法`);
  }

  /**
   * 获取学生答题图片 URL 列表
   * @returns {string[]} 图片 URL 数组
   */
  getAnswerImageUrls() {
    throw new Error(`[${this.name}] 需要实现 getAnswerImageUrls() 方法`);
  }

  /**
   * 自动填入分数
   * @param {string|number} score 分数
   * @returns {boolean} 是否成功
   */
  fillScore(score) {
    throw new Error(`[${this.name}] 需要实现 fillScore() 方法`);
  }

  /**
   * 跳转到下一题
   * @returns {boolean} 是否成功触发
   */
  goToNext() {
    throw new Error(`[${this.name}] 需要实现 goToNext() 方法`);
  }

  // ============ 可选覆盖的方法 ============

  /**
   * 检测是否已翻到新题（图片变化）
   * @param {string[]} oldImageUrls 旧的图片 URL 列表
   * @returns {boolean}
   */
  hasChangedToNewQuestion(oldImageUrls) {
    const newUrls = this.getAnswerImageUrls();
    if (newUrls.length === 0) return false;
    return JSON.stringify(newUrls) !== JSON.stringify(oldImageUrls);
  }

  /**
   * 获取 Angular Scope（用于零分题提取）
   * @returns {Object|null} Angular scope 对象
   */
  getAngularScope() {
    // 默认实现，子类可以覆盖
    return null;
  }

  /**
   * 提取所有题目列表
   * @returns {Array} 题目列表 [{ index, id, score }]
   */
  extractAllTopicList() {
    // 默认实现，子类需要覆盖
    return [];
  }

  /**
   * 提取零分题列表
   * @returns {Array} 零分题列表 [{ index, id, score, reviewCount }]
   */
  extractZeroScoreList() {
    // 默认实现，子类需要覆盖
    return [];
  }

  /**
   * 提取满分题列表
   * @param {Object} reviewHistory 回评历史记录 { index: reviewCount }
   * @returns {Promise<Array>} 满分题列表 [{ index, id, score, maxScore, reviewCount }]
   */
  extractFullScoreList(reviewHistory = {}) {
    // 默认实现，子类需要覆盖
    return Promise.resolve([]);
  }

  /**
   * 跳转到指定题目
   * @param {number} idx 题目索引（从0开始）
   * @param {string|number} id 题目ID
   * @returns {boolean} 是否成功
   */
  jumpToTask(idx, id) {
    // 默认实现，子类需要覆盖
    return false;
  }

  /**
   * 注入悬浮控制 UI
   */
  injectUI() {
    if (document.getElementById('ai-grading-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'ai-grading-panel';
    panel.innerHTML = `
      <style>
        #ai-grading-panel {
          position: fixed;
          top: 60px;
          right: 20px;
          z-index: 99999;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          min-width: 200px;
          color: white;
        }
        #ai-grading-panel .panel-header {
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        #ai-grading-panel .panel-header::before {
          content: '🤖';
          font-size: 18px;
        }
        #ai-grading-panel .auto-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          font-size: 13px;
          cursor: pointer;
          padding: 8px 12px;
          background: rgba(255,255,255,0.15);
          border-radius: 8px;
          transition: background 0.2s;
        }
        #ai-grading-panel .auto-toggle:hover {
          background: rgba(255,255,255,0.25);
        }
        #ai-grading-panel .auto-toggle input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        #ai-grading-panel .start-btn {
          width: 100%;
          padding: 10px;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        #ai-grading-panel .start-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        #ai-grading-panel .start-btn:active {
          transform: translateY(0);
        }
        #ai-grading-panel .status {
          margin-top: 12px;
          font-size: 12px;
          text-align: center;
          padding: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 6px;
        }
      </style>
      <div class="panel-header">AI 阅卷助手</div>
      <label class="auto-toggle">
        <input type="checkbox" id="ai-auto-check">
        <span>全自动循环批改</span>
      </label>
      <button class="start-btn" id="ai-start-btn">▶ 开始判分</button>
      <div class="status" id="ai-status">就绪</div>
    `;
    
    document.body.appendChild(panel);

    // 绑定事件
    document.getElementById('ai-start-btn').onclick = () => this.startGrading();
    document.getElementById('ai-auto-check').onchange = (e) => {
      this.config.autoGrading = e.target.checked;
    };
  }

  /**
   * 更新状态显示
   * @param {string} text 状态文本
   * @param {string} type 类型：info/success/error/loading
   */
  updateStatus(text, type = 'info') {
    const el = document.getElementById('ai-status');
    if (!el) return;
    
    const icons = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      loading: '⏳'
    };
    
    el.innerText = `${icons[type] || ''} ${text}`;
  }

  /**
   * 开始阅卷流程
   */
  async startGrading() {
    if (this.config.isGrading) {
      console.log('[GradingSite] 正在阅卷中，请稍候...');
      return;
    }

    const imageUrls = this.getAnswerImageUrls();
    
    if (imageUrls.length === 0) {
      this.updateStatus('未找到答题图片', 'error');
      if (this.config.autoGrading) {
        setTimeout(() => this.startGrading(), 1000);
      }
      return;
    }

    this.config.isGrading = true;
    this.updateStatus('正在切换到 AI...', 'loading');

    // 获取保存的配置
    chrome.storage.local.get(['gradingConfig', 'selectedAIPlatform'], (result) => {
      const gradingConfig = result.gradingConfig || {
        subject: '通用',
        questionType: '通用',
        totalScore: 10,
        answers: [],
        gradingRules: ''
      };

      // 发送请求到 background
      chrome.runtime.sendMessage({
        type: 'GRADE_REQUEST',
        imageUrls: imageUrls,
        config: gradingConfig,
        aiPlatform: result.selectedAIPlatform || 'kimi',
        gradingSite: this.name
      });
    });
  }

  /**
   * 处理阅卷结果
   * @param {object} result { score, details }
   */
  handleGradeResult(result) {
    console.log(`[${this.name}] 收到评分结果:`, result.score);
    this.updateStatus(`AI 评分: ${result.score}`, 'success');

    const success = this.fillScore(result.score);

    if (this.config.autoGrading && success) {
      this.updateStatus('3秒后进入下一题...', 'loading');
      setTimeout(() => {
        this.goToNextAndContinue();
      }, 3000);
    } else {
      this.config.isGrading = false;
    }
  }

  /**
   * 处理错误
   * @param {string} message 错误信息
   */
  handleError(message) {
    this.updateStatus(message, 'error');
    this.config.isGrading = false;
    this.config.autoGrading = false;
    
    const checkbox = document.getElementById('ai-auto-check');
    if (checkbox) checkbox.checked = false;
  }

  /**
   * 跳转下一题并继续循环
   */
  goToNextAndContinue() {
    const oldImages = this.getAnswerImageUrls();
    this.goToNext();
    this.updateStatus('加载下一题...', 'loading');

    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      
      if (this.hasChangedToNewQuestion(oldImages)) {
        clearInterval(interval);
        this.config.isGrading = false;
        this.startGrading();
      }
      
      if (checks > 20) {
        clearInterval(interval);
        this.config.isGrading = false;
        this.updateStatus('翻页超时', 'error');
      }
    }, 1000);
  }

  /**
   * 初始化适配器
   */
  init() {
    console.log(`[${this.name}] 适配器初始化`);
    
    // 注入 UI
    setTimeout(() => this.injectUI(), 1500);
    
    // 监听消息
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'GRADE_RESULT') {
        this.handleGradeResult(msg);
      }
      if (msg.type === 'ERROR') {
        this.handleError(msg.message);
      }
    });
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.GradingSiteAdapter = GradingSiteAdapter;
}

export default GradingSiteAdapter;

