// content_ai.js - 完整覆盖版
console.log("AI 阅卷助手：Kimi 自动切换版 v8.0 已就绪");

chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "DO_AI_TASK") {
        handleKimiGrading(request);
    }
});

// 工具函数
function base64ToBlob(base64, mimeType = 'image/png') {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function handleKimiGrading(data) {
    console.log("🚀 开始处理新题目...");

    // ... (输入框查找、粘贴图片逻辑保持不变) ...
    // 假设已经粘贴完图片

    // --- 【核心】构造超级 Prompt ---
    const cfg = data.config; // 接收传过来的复杂配置

    // 1. 构建答案列表字符串
    let answersPrompt = "";
    if (cfg.answers && cfg.answers.length > 0) {
        cfg.answers.forEach((ans, index) => {
            answersPrompt += `
【采分点 ${index + 1}】(分值: ${ans.score}分)
- 标准答案内容：${ans.content}
- 核心关键词：${ans.keywords ? ans.keywords : "无"}
`;
        });
    } else {
        answersPrompt = "无具体标准答案，请根据学科常识判断。";
    }

    // 2. 拼接最终 Prompt
    const promptText = `
我需要你扮演阅卷老师。
【基本信息】：科目-${cfg.subject} | 题型-${cfg.questionType} | 本题满分-${cfg.totalScore}分。

【参考答案与采分点】：
${answersPrompt}

【整体评分规则】：
${cfg.gradingRules ? cfg.gradingRules : "请根据答案匹配度酌情给分。"}

【任务要求】：
请根据学生作答图片（已粘贴），结合上述采分点和关键词进行打分。
**重要：请严格按照标准，只返回一个最终分数的数字（例如：4），不要输出任何解释或多余文字。**
`;

    // 3. 填入文字并发送
    document.execCommand('insertText', false, promptText);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(500);

    // 4. 发送 (闭环验证)
    const sendSuccess = await robustSendLogic(editor);

    if (sendSuccess) {
        waitForNewResponseAndSwitchBack(initialCount);
    } else {
        chrome.runtime.sendMessage({ type: "ERROR", message: "发送失败" });
    }
}

// 健壮发送逻辑：点击 -> 检查清空 -> 循环
async function robustSendLogic(editor) {
    console.log("🛡️ 尝试发送...");
    let attempts = 0;
    // 30秒超时
    while (attempts < 60) {
        attempts++;

        // 找按钮 (兼容多种 class)
        const btn = document.querySelector('.send-button') ||
            document.querySelector('button[class*="send"]') ||
            document.querySelector('[data-testid="send-button"]');

        if (btn) {
            // 检查禁用状态
            const style = window.getComputedStyle(btn);
            const isVisuallyDisabled = btn.disabled || btn.classList.contains('disabled') || style.pointerEvents === 'none' || style.opacity < 0.5;

            if (!isVisuallyDisabled) {
                btn.click();
                await sleep(100);
                btn.click(); // 双击

                await sleep(800); // 等待清空

                // 检查是否清空 (且没图片了)
                if (editor.innerText.replace(/\s/g, '').length < 5 && !editor.querySelector('img')) {
                    console.log("✅ 发送成功");
                    return true;
                }
            }
        }
        await sleep(500);
    }
    return false;
}

// 监听回复并通知切换
function waitForNewResponseAndSwitchBack(oldBubbleCount) {
    console.log("⏳ 等待 AI 回复...");
    let checkCount = 0;
    let stableCount = 0;
    let lastTextLength = 0;

    const interval = setInterval(() => {
        checkCount++;
        const bubbles = document.querySelectorAll('div[class*="markdown"]');

        if (bubbles.length <= oldBubbleCount) {
            if (checkCount > 60) {
                clearInterval(interval);
                chrome.runtime.sendMessage({ type: "ERROR", message: "AI 回复超时" });
            }
            return;
        }

        const text = bubbles[bubbles.length - 1].innerText;
        if (!text) return;

        // 等待内容稳定
        if (text.length === lastTextLength && text.length > 0) stableCount++;
        else stableCount = 0;
        lastTextLength = text.length;

        if (stableCount >= 2) {
            const scoreMatch = text.match(/(\d+)/);
            clearInterval(interval);

            // 【核心】做完了，喊后台切回去
            chrome.runtime.sendMessage({
                type: "AI_DONE_AND_SWITCH_BACK",
                score: scoreMatch ? scoreMatch[0] : "?",
                details: text
            });
        }
    }, 1000);
}