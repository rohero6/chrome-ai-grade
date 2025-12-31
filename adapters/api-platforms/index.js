// adapters/api-platforms/index.js
// API 平台适配器索引

import OpenAIAdapter from './openai.js';
import GeminiAdapter from './gemini.js';
import ModelScopeAdapter from './modelscope.js';
import ZhipuAdapter from './zhipu.js';

// 所有可用的 API 平台适配器
const apiPlatformAdapters = [
  OpenAIAdapter,
  GeminiAdapter,
  ModelScopeAdapter,
  ZhipuAdapter
];

// 根据名称获取适配器类
function getAdapterByName(name) {
  for (const AdapterClass of apiPlatformAdapters) {
    // 创建临时实例来检查名称
    const tempAdapter = new AdapterClass();
    if (tempAdapter.name === name) {
      return AdapterClass; // 返回类而不是实例
    }
  }
  return null;
}

// 获取所有适配器信息（用于 popup 显示）
function getAllAdapterInfo() {
  return apiPlatformAdapters.map(AdapterClass => {
    const adapter = new AdapterClass();
    return {
      name: adapter.name,
      displayName: adapter.displayName,
      requiredConfig: adapter.requiredConfig
    };
  });
}

export { apiPlatformAdapters, getAdapterByName, getAllAdapterInfo };
export default apiPlatformAdapters;

