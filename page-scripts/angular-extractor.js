// page-scripts/angular-extractor.js
// 在页面上下文中执行的脚本（绕过 content script 隔离）

(function() {
  'use strict';
  
  console.log('[页面脚本] 脚本开始执行');
  console.log('[页面脚本] window 对象:', window);
  
  // 提取零分题列表
  window.__aiGradingExtractZeroScore = function(reviewHistory, requestId) {
    console.log('[页面脚本] 开始提取零分题，requestId:', requestId);
    console.log('[页面脚本] reviewHistory:', reviewHistory);
    
    try {
      const el = document.querySelector('#frame2');
      console.log('[页面脚本] #frame2 元素:', el ? '找到' : '未找到');
      
      if (!el) {
        console.log('[页面脚本] ❌ 未找到 #frame2 元素');
        document.dispatchEvent(new CustomEvent('aiGradingResult', {
          detail: { type: 'ZERO_SCORE_RESULT', requestId, list: [] }
        }));
        return;
      }
      
      if (typeof angular === 'undefined') {
        console.log('[页面脚本] ❌ Angular 未加载');
        document.dispatchEvent(new CustomEvent('aiGradingResult', {
          detail: { type: 'ZERO_SCORE_RESULT', requestId, list: [] }
        }));
        return;
      }
      
      console.log('[页面脚本] ✅ Angular 已加载');
      const scope = angular.element(el).scope();
      console.log('[页面脚本] scope:', scope ? '找到' : '未找到');
      
      if (!scope) {
        console.log('[页面脚本] ❌ 无法获取 scope');
        document.dispatchEvent(new CustomEvent('aiGradingResult', {
          detail: { type: 'ZERO_SCORE_RESULT', requestId, list: [] }
        }));
        return;
      }
      
      const taskList = scope?.taskList || scope?.$root?.taskList || [];
      console.log('[页面脚本] taskList 长度:', taskList.length);
      
      if (taskList.length === 0) {
        console.log('[页面脚本] ⚠️ taskList 为空');
        console.log('[页面脚本] scope.taskList:', scope?.taskList);
        console.log('[页面脚本] scope.$root?.taskList:', scope?.$root?.taskList);
        document.dispatchEvent(new CustomEvent('aiGradingResult', {
          detail: { type: 'ZERO_SCORE_RESULT', requestId, list: [] }
        }));
        return;
      }
      
      // 打印第一道题的数据
      if (taskList.length > 0) {
        console.log('[页面脚本] 第一道题数据:', taskList[0]);
        console.log('[页面脚本] 第一道题 score:', taskList[0].score, '类型:', typeof taskList[0].score);
      }
      
      const zeroScoreList = taskList
        .map((item, idx) => ({
          index: idx + 1,
          id: item.id,
          score: item.score || 0,
          reviewCount: (reviewHistory[idx + 1] || 0)
        }))
        .filter(item => item.score === 0);
      
      console.log('[页面脚本] ✅ 找到', zeroScoreList.length, '道零分题');
      console.log('[页面脚本] 零分题列表:', zeroScoreList);
      
      // 打印分数分布
      const scoreDist = {};
      taskList.forEach(item => {
        const score = item.score || 0;
        scoreDist[score] = (scoreDist[score] || 0) + 1;
      });
      console.log('[页面脚本] 分数分布:', scoreDist);
      
      document.dispatchEvent(new CustomEvent('aiGradingResult', {
        detail: { type: 'ZERO_SCORE_RESULT', requestId, list: zeroScoreList }
      }));
      console.log('[页面脚本] ✅ 已发送结果事件');
    } catch (e) {
      console.error('[页面脚本] ❌ 错误:', e);
      document.dispatchEvent(new CustomEvent('aiGradingResult', {
        detail: { type: 'ZERO_SCORE_RESULT', requestId, list: [] }
      }));
    }
  };

  // 提取满分题列表
  window.__aiGradingExtractFullScore = function(reviewHistory, requestId) {
    console.log('[页面脚本] 开始提取满分题，requestId:', requestId);
    console.log('[页面脚本] reviewHistory:', reviewHistory);
    
    try {
      const el = document.querySelector('#frame2');
      console.log('[页面脚本] #frame2 元素:', el ? '找到' : '未找到');
      
      if (!el) {
        console.log('[页面脚本] ❌ 未找到 #frame2 元素');
        document.dispatchEvent(new CustomEvent('aiGradingResult', {
          detail: { type: 'FULL_SCORE_RESULT', requestId, list: [], error: '未找到 #frame2 元素' }
        }));
        return;
      }
      
      if (typeof angular === 'undefined') {
        console.log('[页面脚本] ❌ Angular 未加载');
        document.dispatchEvent(new CustomEvent('aiGradingResult', {
          detail: { type: 'FULL_SCORE_RESULT', requestId, list: [], error: 'Angular 未加载' }
        }));
        return;
      }
      
      console.log('[页面脚本] ✅ Angular 已加载');
      const scope = angular.element(el).scope();
      console.log('[页面脚本] scope:', scope ? '找到' : '未找到');
      
      if (!scope) {
        console.log('[页面脚本] ❌ 无法获取 scope');
        document.dispatchEvent(new CustomEvent('aiGradingResult', {
          detail: { type: 'FULL_SCORE_RESULT', requestId, list: [], error: '无法获取 Angular scope' }
        }));
        return;
      }
      
      const taskList = scope?.taskList || scope?.$root?.taskList || [];
      console.log('[页面脚本] taskList 长度:', taskList.length);
      
      if (taskList.length === 0) {
        console.log('[页面脚本] ⚠️ taskList 为空');
        document.dispatchEvent(new CustomEvent('aiGradingResult', {
          detail: { type: 'FULL_SCORE_RESULT', requestId, list: [], error: 'taskList 为空' }
        }));
        return;
      }
      
      // 打印第一道题的数据，查看是否有满分字段
      if (taskList.length > 0) {
        console.log('[页面脚本] 第一道题数据:', taskList[0]);
        console.log('[页面脚本] 第一道题 score:', taskList[0].score, '类型:', typeof taskList[0].score);
        console.log('[页面脚本] 第一道题 totalScore:', taskList[0].totalScore, 'maxScore:', taskList[0].maxScore, 'fullScore:', taskList[0].fullScore);
      }
      
      // 提取满分题列表
      // 尝试从题目数据中获取满分，如果没有则使用score作为满分（假设score就是满分）
      const fullScoreList = taskList
        .map((item, idx) => {
          const currentScore = item.score || 0;
          // 尝试获取满分：优先使用 totalScore, maxScore, fullScore，否则使用 score（如果score > 0）
          const maxScore = item.totalScore || item.maxScore || item.fullScore || (currentScore > 0 ? currentScore : null);
          
          return {
            index: idx + 1,
            id: item.id,
            score: currentScore,
            maxScore: maxScore,
            reviewCount: (reviewHistory[idx + 1] || 0)
          };
        })
        .filter(item => {
          // 如果当前分数等于满分，则认为是满分题
          if (item.maxScore !== null && item.maxScore !== undefined) {
            return item.score === item.maxScore;
          }
          // 如果没有满分信息，但分数大于0，也认为是满分（保守策略）
          return item.score > 0;
        });
      
      console.log('[页面脚本] ✅ 找到', fullScoreList.length, '道满分题');
      console.log('[页面脚本] 满分题列表:', fullScoreList);
      
      // 打印分数分布
      const scoreDist = {};
      taskList.forEach(item => {
        const score = item.score || 0;
        scoreDist[score] = (scoreDist[score] || 0) + 1;
      });
      console.log('[页面脚本] 分数分布:', scoreDist);
      
      document.dispatchEvent(new CustomEvent('aiGradingResult', {
        detail: { type: 'FULL_SCORE_RESULT', requestId, list: fullScoreList }
      }));
      console.log('[页面脚本] ✅ 已发送结果事件');
    } catch (e) {
      console.error('[页面脚本] ❌ 错误:', e);
      document.dispatchEvent(new CustomEvent('aiGradingResult', {
        detail: { type: 'FULL_SCORE_RESULT', requestId, list: [], error: e.message }
      }));
    }
  };
  
  // 跳转到指定题目
  window.__aiGradingJumpToTask = function(idx, id) {
    console.log('[页面脚本] 开始跳转，idx:', idx, 'id:', id);
    try {
      const el = document.querySelector('#frame2');
      if (!el) {
        console.error('[页面脚本] ❌ 无法找到 #frame2 来跳转任务');
        return false;
      }
      
      if (typeof angular === 'undefined') {
        console.error('[页面脚本] ❌ Angular 未加载');
        return false;
      }
      
      const scope = angular.element(el).scope();
      if (!scope) {
        console.error('[页面脚本] ❌ 无法获取 Angular scope 来跳转任务');
        return false;
      }
      
      const root = scope.$root;
      root.historyTaskFlag = true;
      root.historyTaskIdx = idx;
      root.taskId = id;
      
      console.log('[页面脚本] 设置跳转参数:', { historyTaskFlag: root.historyTaskFlag, historyTaskIdx: root.historyTaskIdx, taskId: root.taskId });
      
      // 调用 getCorrectTask
      if (typeof scope.getCorrectTask === 'function') {
        console.log('[页面脚本] 调用 scope.getCorrectTask()');
        scope.getCorrectTask();
      } else {
        console.error('[页面脚本] ❌ scope.getCorrectTask 不是函数');
        return false;
      }
      
      scope.$apply(); // 应用 Angular 范围的更改
      console.log('[页面脚本] ✅ 跳转成功，题号:', idx + 1);
      return true;
    } catch (e) {
      console.error('[页面脚本] ❌ 跳转失败:', e);
      return false;
    }
  };
  
  // 监听跳转请求事件
  document.addEventListener('aiGradingJumpRequest', function(event) {
    console.log('[页面脚本] 收到跳转请求事件:', event.detail);
    if (event.detail && event.detail.type === 'jumpToTask') {
      const result = window.__aiGradingJumpToTask(event.detail.idx, event.detail.id);
      // 发送结果
      document.dispatchEvent(new CustomEvent('aiGradingJumpResult', {
        detail: { type: 'JUMP_RESULT', requestId: event.detail.requestId, success: result }
      }));
    }
  });
  
  console.log('[页面脚本] ✅ 函数已定义');
  console.log('[页面脚本] window.__aiGradingExtractZeroScore:', typeof window.__aiGradingExtractZeroScore);
  console.log('[页面脚本] window.__aiGradingJumpToTask:', typeof window.__aiGradingJumpToTask);
  
  // 监听来自 content script 的请求事件
  document.addEventListener('aiGradingRequest', function(event) {
    console.log('[页面脚本] 收到请求事件:', event.detail);
    if (event.detail && event.detail.type === 'extractZeroScore') {
      console.log('[页面脚本] 处理提取零分题请求');
      window.__aiGradingExtractZeroScore(event.detail.reviewHistory, event.detail.requestId);
    } else if (event.detail && event.detail.type === 'extractFullScore') {
      console.log('[页面脚本] 处理提取满分题请求');
      window.__aiGradingExtractFullScore(event.detail.reviewHistory, event.detail.requestId);
    }
  });
  
  console.log('[AI阅卷] 页面脚本已注入');
})();

