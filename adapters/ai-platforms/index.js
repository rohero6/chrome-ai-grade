// adapters/ai-platforms/index.js
// AI 平台适配器索引

import KimiAdapter from './kimi.js';
import DoubaoAdapter from './doubao.js';
import DeepSeekAdapter from './deepseek.js';
// 在此添加更多适配器导入
// import ChatGPTAdapter from './chatgpt.js';
// import ClaudeAdapter from './claude.js';

// 所有可用的 AI 平台适配器
const aiPlatformAdapters = [
  KimiAdapter,
  DoubaoAdapter,
  DeepSeekAdapter,
  // ChatGPTAdapter,
  // ClaudeAdapter,
];

// 根据 URL 获取匹配的适配器
function getAdapterByUrl(url) {
  for (const AdapterClass of aiPlatformAdapters) {
    const adapter = new AdapterClass();
    const matched = adapter.matchPatterns.some(pattern => {
      const regex = new RegExp(
        '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
      );
      return regex.test(url);
    });
    if (matched) {
      return adapter;
    }
  }
  return null;
}

// 根据名称获取适配器
function getAdapterByName(name) {
  for (const AdapterClass of aiPlatformAdapters) {
    const adapter = new AdapterClass();
    if (adapter.name === name) {
      return adapter;
    }
  }
  return null;
}

// 获取所有适配器信息（用于 popup 显示）
function getAllAdapterInfo() {
  return aiPlatformAdapters.map(AdapterClass => {
    const adapter = new AdapterClass();
    return {
      name: adapter.name,
      displayName: adapter.displayName,
      matchPatterns: adapter.matchPatterns,
      capabilities: adapter.capabilities
    };
  });
}

export { aiPlatformAdapters, getAdapterByUrl, getAdapterByName, getAllAdapterInfo };
export default aiPlatformAdapters;

