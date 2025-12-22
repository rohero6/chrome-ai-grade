// background/service-worker.js
// 后台服务 - 协调改卷网站和 AI 平台之间的通信

console.log('[AI阅卷] Background Service Worker 启动');

// 状态管理
let gradingTabId = null;  // 改卷页面的 Tab ID
let aiTabId = null;       // AI 平台页面的 Tab ID

// AI 平台 URL 匹配模式
const AI_PLATFORM_PATTERNS = {
  kimi: ['*://kimi.com/*', '*://www.kimi.com/*', '*://kimi.moonshot.cn/*'],
  doubao: ['*://www.doubao.com/*', '*://doubao.com/*'],
  deepseek: ['*://chat.deepseek.com/*', '*://www.deepseek.com/*']
};

// 下载图片并转换为 Base64
async function fetchImageAndConvertToBase64(url) {
  try {
    console.log('[Background] 下载图片:', url);
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('[Background] 图片下载失败:', url, e);
    return null;
  }
}

// 查找 AI 平台标签页
async function findAITab(platformName) {
  const patterns = AI_PLATFORM_PATTERNS[platformName] || AI_PLATFORM_PATTERNS.kimi;
  
  const tabs = await chrome.tabs.query({ url: patterns });
  return tabs.length > 0 ? tabs[0] : null;
}

// 切换到 AI 平台并执行任务（与旧版本逻辑一致）
async function switchToAIAndExecute(imagesBase64, config, platformName) {
  const aiTab = await findAITab(platformName);
  
  if (!aiTab) {
    throw new Error(`未找到 ${platformName} 网页，请先打开！`);
  }
  
  aiTabId = aiTab.id;
  
  // 【核心动作】强制激活 AI 标签页！
  await chrome.tabs.update(aiTabId, { active: true });
  
  // 给页面 500ms 苏醒时间
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 发送任务到 AI 页面（config 传过去，让 AI 页面构建 Prompt）
  chrome.tabs.sendMessage(aiTabId, {
    type: 'DO_AI_TASK',
    imagesBase64: imagesBase64,
    config: config // 直接把整个配置对象传过去
  });
}

// 消息监听（使用与旧版本一致的消息类型）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // 1. 改卷页面发起请求 -> 切去 AI（与旧版本消息类型一致）
  if (request.type === 'DOWNLOAD_AND_GRADE_REQUEST') {
    console.log('[Background] 收到改卷请求，准备下载并切到 AI...');
    gradingTabId = sender.tab.id; // 【关键】记下改卷页面 ID
    
    // 并发下载所有图片
    Promise.all(request.imageUrls.map(url => fetchImageAndConvertToBase64(url)))
      .then(base64List => {
        const validImages = base64List.filter(img => img !== null);
        
        if (validImages.length === 0) {
          chrome.tabs.sendMessage(gradingTabId, {
            type: 'ERROR',
            message: '图片下载失败，请检查网络'
          });
          return;
        }
        
        console.log(`[Background] 下载完成 ${validImages.length} 张图片，切换到 AI...`);
        
        // 切换到 AI 并执行任务
        switchToAIAndExecute(validImages, request.config, request.aiPlatform || 'kimi')
          .catch(err => {
            chrome.tabs.sendMessage(gradingTabId, {
              type: 'ERROR',
              message: err.message
            });
            // 切回改卷页面
            chrome.tabs.update(gradingTabId, { active: true });
          });
      })
      .catch(err => {
        chrome.tabs.sendMessage(gradingTabId, {
          type: 'ERROR',
          message: '处理图片时出错: ' + err.message
        });
      });
  }
  
  // 2. AI 完成任务 -> 切回改卷页（与旧版本消息类型一致）
  if (request.type === 'AI_DONE_AND_SWITCH_BACK') {
    console.log('[Background] AI 完成，切回改卷页面...', '分数:', request.score);
    
    if (gradingTabId) {
      // 先切回去
      chrome.tabs.update(gradingTabId, { active: true }, () => {
        // 再发消息 (延时一点点确保页面苏醒)
        setTimeout(() => {
          chrome.tabs.sendMessage(gradingTabId, {
            type: 'GRADE_RESULT',
            score: request.score,
            details: request.details
          });
        }, 200);
      });
    }
  }
  
  // 3. 错误处理转发
  if (request.type === 'ERROR') {
    console.error('[Background] 错误:', request.message);
    
    if (gradingTabId) {
      chrome.tabs.sendMessage(gradingTabId, request);
      // 出错了也要切回去让用户看
      chrome.tabs.update(gradingTabId, { active: true });
    }
  }
});

// 扩展安装/更新时
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[AI阅卷] 扩展已安装/更新:', details.reason);
  
  // 设置默认配置
  chrome.storage.local.get(['gradingConfig', 'selectedAIPlatform'], (result) => {
    if (!result.gradingConfig) {
      chrome.storage.local.set({
        gradingConfig: {
          subject: '语文',
          questionType: '默写题',
          totalScore: 6,
          answers: [{ score: 2, keywords: '', content: '' }],
          gradingRules: ''
        }
      });
    }
    if (!result.selectedAIPlatform) {
      chrome.storage.local.set({ selectedAIPlatform: 'kimi' });
    }
  });
});

