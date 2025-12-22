// core/adapter-registry.js
// 适配器注册中心

class AdapterRegistry {
  constructor() {
    this.gradingSites = new Map();
    this.aiPlatforms = new Map();
  }

  // 注册改卷网站适配器
  registerGradingSite(AdapterClass) {
    const adapter = new AdapterClass();
    this.gradingSites.set(adapter.name, adapter);
    console.log(`[Registry] 注册改卷网站: ${adapter.name}`);
  }

  // 注册 AI 平台适配器
  registerAIPlatform(AdapterClass) {
    const adapter = new AdapterClass();
    this.aiPlatforms.set(adapter.name, adapter);
    console.log(`[Registry] 注册 AI 平台: ${adapter.name}`);
  }

  // 获取所有改卷网站
  getAllGradingSites() {
    return Array.from(this.gradingSites.values());
  }

  // 获取所有 AI 平台
  getAllAIPlatforms() {
    return Array.from(this.aiPlatforms.values());
  }

  // 根据名称获取改卷网站适配器
  getGradingSiteByName(name) {
    return this.gradingSites.get(name) || null;
  }

  // 根据名称获取 AI 平台适配器
  getAIPlatformByName(name) {
    return this.aiPlatforms.get(name) || null;
  }

  // 根据 URL 匹配改卷网站适配器
  getGradingSiteByUrl(url) {
    for (const adapter of this.gradingSites.values()) {
      if (this._matchUrl(url, adapter.matchPatterns)) {
        return adapter;
      }
    }
    return null;
  }

  // 根据 URL 匹配 AI 平台适配器
  getAIPlatformByUrl(url) {
    for (const adapter of this.aiPlatforms.values()) {
      if (this._matchUrl(url, adapter.matchPatterns)) {
        return adapter;
      }
    }
    return null;
  }

  // URL 匹配工具
  _matchUrl(url, patterns) {
    return patterns.some(pattern => {
      // 将通配符模式转换为正则表达式
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(url);
    });
  }

  // 获取所有匹配模式（用于 manifest）
  getAllGradingSitePatterns() {
    const patterns = [];
    for (const adapter of this.gradingSites.values()) {
      patterns.push(...adapter.matchPatterns);
    }
    return [...new Set(patterns)];
  }

  getAllAIPlatformPatterns() {
    const patterns = [];
    for (const adapter of this.aiPlatforms.values()) {
      patterns.push(...adapter.matchPatterns);
    }
    return [...new Set(patterns)];
  }
}

// 单例
const registry = new AdapterRegistry();

// 导出
if (typeof window !== 'undefined') {
  window.AdapterRegistry = registry;
}

export default registry;

