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

    // 1. 记数
    const bubblesSelector = 'div[class*="markdown"]';
    const initialCount = document.querySelectorAll(bubblesSelector).length;

    // 2. 找输入框
    let editor = document.querySelector('div[contenteditable="true"]') || document.querySelector('#chat-input');
    if (!editor) {
        console.error("❌ 找不到输入框");
        chrome.runtime.sendMessage({ type: "ERROR", message: "找不到 Kimi 输入框" });
        return;
    }
    editor.focus();

    // 3. 粘贴图片
    if (data.imagesBase64 && data.imagesBase64.length > 0) {
        const dataTransfer = new DataTransfer();
        for (let i = 0; i < data.imagesBase64.length; i++) {
            const blob = base64ToBlob(data.imagesBase64[i]);
            const file = new File([blob], `answer_${i}.png`, { type: "image/png" });
            dataTransfer.items.add(file);
        }
        editor.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dataTransfer }));
        // 因为现在在前台，不需要死等，交给 robustSendLogic 去判断
    }

    // 4. 填文字
    const promptText = `科目：${data.subject}。评分标准：${data.standard}。请打分，只返回数字。`;
    document.execCommand('insertText', false, promptText);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(500);

    // 5. 发送 (闭环验证)
    const sendSuccess = await robustSendLogic(editor);

    if (sendSuccess) {
        waitForNewResponseAndSwitchBack(initialCount);
    } else {
        chrome.runtime.sendMessage({ type: "ERROR", message: "发送失败，可能卡住了" });
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