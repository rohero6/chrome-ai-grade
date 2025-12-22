// core/message-hub.js
// 统一消息通信中心

const MessageTypes = {
  // 改卷网站 -> Background
  GRADE_REQUEST: 'GRADE_REQUEST',
  
  // Background -> AI 平台
  DO_AI_TASK: 'DO_AI_TASK',
  
  // AI 平台 -> Background
  AI_DONE: 'AI_DONE',
  
  // Background -> 改卷网站
  GRADE_RESULT: 'GRADE_RESULT',
  
  // 错误通知
  ERROR: 'ERROR',
  
  // 状态更新
  STATUS_UPDATE: 'STATUS_UPDATE'
};

// 发送消息到 background
function sendToBackground(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// 发送消息到指定 tab
function sendToTab(tabId, type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// 监听消息
function onMessage(callback) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const result = callback(request, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch(err => sendResponse({ error: err.message }));
      return true; // 保持消息通道开放
    }
    return false;
  });
}

// 导出（兼容非模块环境）
if (typeof window !== 'undefined') {
  window.MessageHub = { MessageTypes, sendToBackground, sendToTab, onMessage };
}

export { MessageTypes, sendToBackground, sendToTab, onMessage };

