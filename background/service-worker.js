// background/service-worker.js
// 后台服务 - 协调改卷网站和 AI 平台之间的通信

// 静态导入 API 适配器（Service Worker 不支持动态 import）
import { getAdapterByName } from '../adapters/api-platforms/index.js';
import PromptBuilder from '../core/prompt-builder.js';

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

// 切换到 AI 平台并执行任务（网页模式）
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

// 调用 API 并执行任务（API 模式）
async function callAPIAndExecute(imagesBase64, config, apiPlatformName, apiConfig, imageUrls = null) {
  console.log(`[Background] 使用 API 模式调用 ${apiPlatformName}...`);
  
  // 获取对应的 API 适配器（使用静态导入的函数）
  const AdapterClass = getAdapterByName(apiPlatformName);
  if (!AdapterClass) {
    throw new Error(`未找到 ${apiPlatformName} API 适配器`);
  }
  
  const adapter = new AdapterClass();
  
  // 构建 Prompt（使用 API 专用方法）
  const prompt = PromptBuilder.createForAPI(config);
  
  // 智谱AI特殊处理：使用原始URL而不是base64
  if (apiPlatformName === 'zhipu' && imageUrls && imageUrls.length > 0) {
    console.log('[Background] 智谱AI使用原始图片URL');
    const result = await adapter.executeTaskWithUrls(imageUrls, prompt, apiConfig);
    return result;
  }
  
  // 调用 API（其他平台使用base64）
  const result = await adapter.executeTask(imagesBase64, prompt, apiConfig);
  
  return result;
}

// 消息监听（使用与旧版本一致的消息类型）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // 1. 改卷页面发起请求 -> 切去 AI 或调用 API
  if (request.type === 'DOWNLOAD_AND_GRADE_REQUEST') {
    console.log('[Background] 收到改卷请求...');
    gradingTabId = sender.tab.id; // 【关键】记下改卷页面 ID
    
    // 获取模式配置
    chrome.storage.local.get(['selectedMode', 'selectedAPIPlatform', 'apiConfigs'], async (storage) => {
      const mode = storage.selectedMode || 'web';
      
      // 并发下载所有图片
      try {
        const base64List = await Promise.all(request.imageUrls.map(url => fetchImageAndConvertToBase64(url)));
        const validImages = base64List.filter(img => img !== null);
        
        if (validImages.length === 0) {
          chrome.tabs.sendMessage(gradingTabId, {
            type: 'ERROR',
            message: '图片下载失败，请检查网络'
          });
          return;
        }
        
        console.log(`[Background] 下载完成 ${validImages.length} 张图片，模式: ${mode}`);
        
        if (mode === 'api') {
          // API 模式：直接调用 API
          const apiPlatform = storage.selectedAPIPlatform || 'openai';
          const apiConfigs = storage.apiConfigs || {};
          const apiConfig = apiConfigs[apiPlatform] || {};  // 按平台获取配置
          
          if (!apiConfig.apiKey) {
            chrome.tabs.sendMessage(gradingTabId, {
              type: 'ERROR',
              message: `请先在配置中设置 ${apiPlatform} 的 API Key`
            });
            return;
          }
          
          try {
            console.log(`[Background] API 模式调用 ${apiPlatform}，图片数量: ${validImages.length}`);
            console.log(`[Background] API 配置:`, { model: apiConfig.model || '默认', hasApiKey: !!apiConfig.apiKey });
            
            // 传递原始图片URL（用于智谱AI等需要URL的平台）
            const result = await callAPIAndExecute(validImages, request.config, apiPlatform, apiConfig, request.imageUrls);
            
            console.log(`[Background] API 返回结果:`, { score: result.score, detailsLength: result.details?.length });
            
            // 直接返回结果到改卷页面
            chrome.tabs.sendMessage(gradingTabId, {
              type: 'GRADE_RESULT',
              score: result.score,
              details: result.details
            });
          } catch (err) {
            console.error('[Background] API 调用失败:', err);
            chrome.tabs.sendMessage(gradingTabId, {
              type: 'ERROR',
              message: err.message || 'API 调用失败'
            });
          }
        } else {
          // 网页模式：切换到 AI 平台
          switchToAIAndExecute(validImages, request.config, request.aiPlatform || 'kimi')
            .catch(err => {
              chrome.tabs.sendMessage(gradingTabId, {
                type: 'ERROR',
                message: err.message
              });
              // 切回改卷页面
              chrome.tabs.update(gradingTabId, { active: true });
            });
        }
      } catch (err) {
        chrome.tabs.sendMessage(gradingTabId, {
          type: 'ERROR',
          message: '处理图片时出错: ' + err.message
        });
      }
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

