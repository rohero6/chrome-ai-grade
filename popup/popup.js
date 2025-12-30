// popup/popup.js
// 配置界面脚本

// 配置数据源
const CONFIG_DATA = {
  subjects: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '综合'],
  questionTypesMap: {
    '语文': ['默写题', '阅读理解', '作文', '古诗词鉴赏', '语言运用', '文言文阅读'],
    '数学': ['选择题', '填空题', '解答题', '应用题', '证明题', '计算题'],
    '英语': ['选择题', '完形填空', '阅读理解', '写作', '听力', '翻译题'],
    '物理': ['选择题', '填空题', '计算题', '实验题', '简答题'],
    '化学': ['选择题', '填空题', '实验题', '简答题', '计算题'],
    '生物': ['选择题', '填空题', '简答题', '实验探究题'],
    '历史': ['选择题', '材料分析题', '问答题'],
    '地理': ['选择题', '综合题', '绘图题'],
    '政治': ['选择题', '辨析题', '材料分析题', '简答题'],
    '综合': ['选择题', '填空题', '简答题', '论述题']
  }
};

// AI 平台信息
const AI_PLATFORMS = [
  { name: 'kimi', displayName: 'Kimi', icon: '🌙' },
  { name: 'doubao', displayName: '豆包', icon: '🫘' },
  { name: 'deepseek', displayName: 'DeepSeek', icon: '🔍' }
];

// API 平台模型列表
const API_MODELS = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (推荐)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
  ],
  gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (推荐，免费)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-pro', label: 'Gemini Pro' },
    { value: 'gemini-pro-vision', label: 'Gemini Pro Vision' }
  ],
  modelscope: [
    { value: 'qwen-vl-max', label: 'Qwen-VL-Max (推荐)' },
    { value: 'qwen-vl-plus', label: 'Qwen-VL-Plus' },
    { value: 'qwen-vl', label: 'Qwen-VL' },
    { value: 'qwen-turbo', label: 'Qwen Turbo' }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  const subjectSelect = document.getElementById('subject');
  const typeSelect = document.getElementById('questionType');
  const answersContainer = document.getElementById('answers-container');
  const addBtn = document.getElementById('add-answer');
  const saveBtn = document.getElementById('save');
  const platformSelector = document.getElementById('platform-selector');
  const modeSelector = document.getElementById('mode-selector');
  const apiConfig = document.getElementById('api-config');
  const apiPlatformSelector = document.getElementById('api-platform-selector');
  const apiKeyInput = document.getElementById('api-key');
  const apiModelInput = document.getElementById('api-model');
  const webPlatformTitle = document.getElementById('web-platform-title');

  let selectedPlatform = 'kimi';
  let selectedMode = 'web'; // 'web' 或 'api'
  let selectedAPIPlatform = 'openai';

  // --- 初始化下拉菜单 ---
  function initDropdowns() {
    CONFIG_DATA.subjects.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub;
      opt.innerText = sub;
      subjectSelect.appendChild(opt);
    });

    subjectSelect.addEventListener('change', () => {
      updateTypeSelect(subjectSelect.value);
    });

    updateTypeSelect(CONFIG_DATA.subjects[0]);
  }

  function updateTypeSelect(subject) {
    typeSelect.innerHTML = '';
    const types = CONFIG_DATA.questionTypesMap[subject] || [];
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.innerText = t;
      typeSelect.appendChild(opt);
    });
  }

  // --- 模式选择 ---
  function initModeSelector() {
    const cards = modeSelector.querySelectorAll('.mode-card');
    
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedMode = card.dataset.mode;
        
        // 显示/隐藏相关配置区域
        if (selectedMode === 'api') {
          apiConfig.classList.add('active');
          platformSelector.style.display = 'none';
          webPlatformTitle.style.display = 'none';
        } else {
          apiConfig.classList.remove('active');
          platformSelector.style.display = 'flex';
          webPlatformTitle.style.display = 'flex';
        }
      });
    });
  }

  function setActiveMode(mode) {
    const cards = modeSelector.querySelectorAll('.mode-card');
    cards.forEach(card => {
      if (card.dataset.mode === mode) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
    selectedMode = mode;
    
    // 显示/隐藏相关配置区域
    if (selectedMode === 'api') {
      apiConfig.classList.add('active');
      platformSelector.style.display = 'none';
      webPlatformTitle.style.display = 'none';
    } else {
      apiConfig.classList.remove('active');
      platformSelector.style.display = 'flex';
      webPlatformTitle.style.display = 'flex';
    }
  }

  // --- 更新模型列表 ---
  function updateModelList(platform) {
    const models = API_MODELS[platform] || [];
    apiModelInput.innerHTML = '<option value="">使用默认模型</option>';
    
    models.forEach(model => {
      const opt = document.createElement('option');
      opt.value = model.value;
      opt.textContent = model.label;
      apiModelInput.appendChild(opt);
    });
  }

  // --- API 平台选择 ---
  function initAPIPlatformSelector() {
    const cards = apiPlatformSelector.querySelectorAll('.api-platform-card');
    
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedAPIPlatform = card.dataset.apiPlatform;
        // 切换平台时更新模型列表
        updateModelList(selectedAPIPlatform);
      });
    });
  }

  function setActiveAPIPlatform(platform) {
    const cards = apiPlatformSelector.querySelectorAll('.api-platform-card');
    cards.forEach(card => {
      if (card.dataset.apiPlatform === platform) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
    selectedAPIPlatform = platform;
    // 更新模型列表
    updateModelList(platform);
  }

  // --- AI 平台选择（网页模式） ---
  function initPlatformSelector() {
    const cards = platformSelector.querySelectorAll('.platform-card');
    
    cards.forEach(card => {
      card.addEventListener('click', () => {
        // 移除所有 active
        cards.forEach(c => c.classList.remove('active'));
        // 添加当前 active
        card.classList.add('active');
        selectedPlatform = card.dataset.platform;
      });
    });
  }

  function setActivePlatform(platform) {
    const cards = platformSelector.querySelectorAll('.platform-card');
    cards.forEach(card => {
      if (card.dataset.platform === platform) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
    selectedPlatform = platform;
  }

  // --- 答案卡片管理 ---
  function createAnswerCard(data = {}) {
    const index = document.querySelectorAll('.answer-card').length + 1;
    const div = document.createElement('div');
    div.className = 'answer-card';
    div.innerHTML = `
      <div class="answer-header">
        <span class="answer-title">采分点 ${index}</span>
        <button class="btn-del" title="删除">×</button>
      </div>
      <div class="row" style="margin-bottom:10px;">
        <div class="col" style="flex:0.35;">
          <label>分值</label>
          <input type="number" class="ans-score" value="${data.score || 2}" min="0" max="100">
        </div>
        <div class="col">
          <label>关键词 (逗号分隔)</label>
          <input type="text" class="ans-keywords" value="${data.keywords || ''}" placeholder="如: 坚持,毅力">
        </div>
      </div>
      <label>参考答案</label>
      <textarea class="ans-content" rows="2" placeholder="输入该采分点的标准答案...">${data.content || ''}</textarea>
    `;

    div.querySelector('.btn-del').addEventListener('click', () => {
      div.remove();
      updateIndexes();
    });

    answersContainer.appendChild(div);
  }

  function updateIndexes() {
    const cards = document.querySelectorAll('.answer-card');
    cards.forEach((card, idx) => {
      card.querySelector('.answer-title').innerText = `采分点 ${idx + 1}`;
    });
  }

  // --- 加载与保存 ---
  function loadSettings() {
    chrome.storage.local.get([
      'gradingConfig', 
      'selectedAIPlatform', 
      'selectedMode',
      'selectedAPIPlatform',
      'apiConfig'
    ], (result) => {
      const config = result.gradingConfig || {};

      // 恢复模式选择
      if (result.selectedMode) {
        setActiveMode(result.selectedMode);
      } else {
        setActiveMode('web');
      }

      // 恢复 API 平台选择（需要先设置平台才能更新模型列表）
      const apiPlatform = result.selectedAPIPlatform || 'openai';
      setActiveAPIPlatform(apiPlatform);

      // 恢复 API 配置
      if (result.apiConfig) {
        if (result.apiConfig.apiKey) {
          apiKeyInput.value = result.apiConfig.apiKey;
        }
        if (result.apiConfig.model) {
          // 设置模型值（在更新模型列表之后）
          setTimeout(() => {
            apiModelInput.value = result.apiConfig.model;
          }, 0);
        }
      }

      // 恢复 AI 平台选择（网页模式）
      if (result.selectedAIPlatform) {
        setActivePlatform(result.selectedAIPlatform);
      } else {
        setActivePlatform('kimi');
      }

      // 恢复下拉
      if (config.subject) {
        subjectSelect.value = config.subject;
        updateTypeSelect(config.subject);
      }
      if (config.questionType) typeSelect.value = config.questionType;
      if (config.totalScore) document.getElementById('totalScore').value = config.totalScore;
      if (config.gradingRules) document.getElementById('gradingRules').value = config.gradingRules;

      // 恢复答案列表
      answersContainer.innerHTML = '';
      if (config.answers && config.answers.length > 0) {
        config.answers.forEach(ans => createAnswerCard(ans));
      } else {
        createAnswerCard();
      }
    });
  }

  // 保存逻辑
  saveBtn.addEventListener('click', () => {
    const answers = [];
    document.querySelectorAll('.answer-card').forEach(card => {
      answers.push({
        score: card.querySelector('.ans-score').value,
        keywords: card.querySelector('.ans-keywords').value,
        content: card.querySelector('.ans-content').value
      });
    });

    const config = {
      subject: subjectSelect.value,
      questionType: typeSelect.value,
      totalScore: document.getElementById('totalScore').value,
      gradingRules: document.getElementById('gradingRules').value,
      answers: answers
    };

    const saveData = {
      gradingConfig: config,
      selectedAIPlatform: selectedPlatform,
      selectedMode: selectedMode,
      selectedAPIPlatform: selectedAPIPlatform
    };

    // 如果是 API 模式，保存 API 配置
    if (selectedMode === 'api') {
      saveData.apiConfig = {
        apiKey: apiKeyInput.value,
        model: apiModelInput.value || undefined
      };
    }

    chrome.storage.local.set(saveData, () => {
      const status = document.getElementById('status');
      status.style.display = 'block';
      setTimeout(() => status.style.display = 'none', 2000);
    });
  });

  addBtn.addEventListener('click', () => createAnswerCard());

  // 初始化执行
  initDropdowns();
  initModeSelector();
  initAPIPlatformSelector();
  initPlatformSelector();
  loadSettings();
});

