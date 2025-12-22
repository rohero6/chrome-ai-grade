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

document.addEventListener('DOMContentLoaded', () => {
  const subjectSelect = document.getElementById('subject');
  const typeSelect = document.getElementById('questionType');
  const answersContainer = document.getElementById('answers-container');
  const addBtn = document.getElementById('add-answer');
  const saveBtn = document.getElementById('save');
  const platformSelector = document.getElementById('platform-selector');

  let selectedPlatform = 'kimi';

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

  // --- AI 平台选择 ---
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
    chrome.storage.local.get(['gradingConfig', 'selectedAIPlatform'], (result) => {
      const config = result.gradingConfig || {};

      // 恢复 AI 平台选择
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

    chrome.storage.local.set({
      gradingConfig: config,
      selectedAIPlatform: selectedPlatform
    }, () => {
      const status = document.getElementById('status');
      status.style.display = 'block';
      setTimeout(() => status.style.display = 'none', 2000);
    });
  });

  addBtn.addEventListener('click', () => createAnswerCard());

  // 初始化执行
  initDropdowns();
  initPlatformSelector();
  loadSettings();
});

