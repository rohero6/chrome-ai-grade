// adapters/grading-sites/index.js
// 改卷网站适配器索引

import Wxy100Adapter from './wxy100.js';
// 在此添加更多适配器导入
// import XueErSiAdapter from './xueersi.js';
// import ZhiXueAdapter from './zhixue.js';

// 所有可用的改卷网站适配器
const gradingSiteAdapters = [
  Wxy100Adapter,
  // XueErSiAdapter,
  // ZhiXueAdapter,
];

// 根据 URL 获取匹配的适配器
function getAdapterByUrl(url) {
  for (const AdapterClass of gradingSiteAdapters) {
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

// 获取所有适配器信息（用于 popup 显示）
function getAllAdapterInfo() {
  return gradingSiteAdapters.map(AdapterClass => {
    const adapter = new AdapterClass();
    return {
      name: adapter.name,
      displayName: adapter.displayName,
      matchPatterns: adapter.matchPatterns
    };
  });
}

export { gradingSiteAdapters, getAdapterByUrl, getAllAdapterInfo };
export default gradingSiteAdapters;

