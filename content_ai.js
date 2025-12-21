console.log("AI 阅卷助手：Kimi v6.0 (闭环验证版) 已就绪");

chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "DO_AI_TASK") {
        handleKimiGrading(request);
    }
});

// Base64 转 Blob
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
    console.log("🚀 [v6.0] 开始处理新题目:", data.subject);

    // 1. 记录初始气泡数量
    const bubblesSelector = 'div[class*="markdown"]';
    const initialCount = document.querySelectorAll(bubblesSelector).length;

    // 2. 找到输入框
    let editor = document.querySelector('div[contenteditable="true"]') || document.querySelector('#chat-input');
    if (!editor) { console.error("❌ 找不到输入框"); return; }
    editor.focus();

    // 3. 粘贴图片
    if (data.imagesBase64 && data.imagesBase64.length > 0) {
        console.log("🖼️ 正在粘贴图片...");
        const dataTransfer = new DataTransfer();
        for (let i = 0; i < data.imagesBase64.length; i++) {
            const blob = base64ToBlob(data.imagesBase64[i]);
            const file = new File([blob], `answer_${i}.png`, { type: "image/png" });
            dataTransfer.items.add(file);
        }
        const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dataTransfer });
        editor.dispatchEvent(pasteEvent);
        // 图片上传可能很慢，这里不需要死等，交给后面的发送逻辑去等待
    }

    // 4. 填入文字
    const promptText = `
我需要你扮演阅卷老师。
【科目】：${data.subject}
【评分标准】：${data.standard}

请分析图片中的学生作答。
**重要：请严格按照标准打分，只返回一个数字分数，不要任何解释。**
    `;

    document.execCommand('insertText', false, promptText);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(500);

    // 5. 【核心】寻找按钮 -> 等待可用 -> 点击 -> 验证是否成功
    const sendSuccess = await robustSendLogic(editor);

    if (sendSuccess) {
        waitForNewResponse(initialCount);
    } else {
        console.error("❌ 发送超时或失败");
        chrome.runtime.sendMessage({ type: "ERROR", message: "发送失败，请检查图片上传是否卡住" });
    }
}

/**
 * 🛡️ 健壮的发送逻辑：点击后必须确认输入框被清空，否则视为失败并重试
 */
async function robustSendLogic(editor) {
    console.log("🛡️ 进入闭环发送流程...");
    let attempts = 0;
    const maxAttempts = 60; // 延长到 30秒 (应对慢网速图片上传)

    while (attempts < maxAttempts) {
        attempts++;

        // --- 第一步：找按钮 ---
        const btn = findSendButton();

        if (btn) {
            // --- 第二步：检查显式禁用状态 ---
            // 增加 pointer-events 检查，这是很多灰按钮的实现方式
            const style = window.getComputedStyle(btn);
            const isVisuallyDisabled = btn.disabled ||
                btn.classList.contains('disabled') ||
                btn.getAttribute('aria-disabled') === 'true' ||
                style.pointerEvents === 'none' ||
                style.cursor === 'not-allowed' ||
                style.opacity < 0.5;

            if (!isVisuallyDisabled) {
                // --- 第三步：尝试点击 ---
                console.log(`⚡ [第${attempts}次] 按钮看似可用，尝试点击...`);
                btn.click();
                await sleep(100);
                btn.click(); // 双击保险

                // --- 第四步：闭环验证 (验证输入框是否清空) ---
                // 如果发送成功，Kimi 会清空输入框。如果框里还有字，说明刚才没发出去。
                await sleep(800); // 给它一点时间清空

                // 检查输入框内容 (去除空白符)
                const currentText = editor.innerText.replace(/\s/g, '');
                // 只有当图片也被清掉了（通常图片在输入框里是 img 标签或特定结构），才算空
                // 简单判断：如果长度大幅减小（Prompt没了），就算发送了
                if (currentText.length < 5 && !editor.querySelector('img')) {
                    console.log("✅ 验证成功：输入框已清空，消息发送成功！");
                    return true;
                } else {
                    console.warn(`⚠️ [第${attempts}次] 点击了但输入框未清空，说明按钮实际上仍不可用 (可能还在上传)...`);
                }
            } else {
                console.log(`⏳ [第${attempts}次] 找到按钮，但状态为禁用 (正在上传图片)...`);
            }
        } else {
            console.log(`🔍 [第${attempts}次] 正在扫描发送按钮...`);
        }

        await sleep(500); // 半秒检查一次
    }

    return false;
}

// 辅助：专门找按钮的函数
function findSendButton() {
    // 方案 A: Class 精确匹配
    const precise = document.querySelector('.send-button') ||
        document.querySelector('div[class*="send-button"]');
    if (precise && precise.offsetParent) return precise;

    // 方案 B: 属性匹配
    const attrBtn = document.querySelector('[data-testid="send-button"]') ||
        document.querySelector('[aria-label="发送"]');
    if (attrBtn && attrBtn.offsetParent) return attrBtn;

    // 方案 C: 模糊结构匹配 (找输入框附近的最后一个 button)
    const editor = document.querySelector('div[contenteditable="true"]');
    if (editor && editor.parentElement) {
        let parent = editor.parentElement;
        for (let i = 0; i < 4; i++) { // 向上找4层
            if (!parent) break;
            const buttons = parent.querySelectorAll('button, div[role="button"]');
            // 过滤掉上传按钮
            const valid = Array.from(buttons).filter(b => !b.querySelector('input[type="file"]'));
            if (valid.length > 0) {
                // 返回最后一个可见的
                return valid[valid.length - 1];
            }
            parent = parent.parentElement;
        }
    }
    return null;
}

function waitForNewResponse(oldBubbleCount) {
    console.log("⏳ 等待 AI 回复...");
    let checkCount = 0;
    let stableCount = 0;
    let lastTextLength = 0;

    const interval = setInterval(() => {
        checkCount++;
        const bubbles = document.querySelectorAll('div[class*="markdown"]');

        // 阶段一：等新气泡
        if (bubbles.length <= oldBubbleCount) {
            if (checkCount > 60) {
                clearInterval(interval);
                chrome.runtime.sendMessage({ type: "ERROR", message: "AI 回复超时" });
            }
            return;
        }

        // 阶段二：等生成完
        const lastBubble = bubbles[bubbles.length - 1];
        const text = lastBubble.innerText;
        if (!text) return;

        if (text.length === lastTextLength && text.length > 0) stableCount++;
        else stableCount = 0;

        lastTextLength = text.length;

        if (stableCount >= 2) {
            console.log("✅ 内容稳定:", text);
            const scoreMatch = text.match(/(\d+)/);
            if (scoreMatch) {
                console.log("🎯 分数:", scoreMatch[0]);
                clearInterval(interval);
                chrome.runtime.sendMessage({ type: "AI_DONE", score: scoreMatch[0], details: text });
            } else {
                console.warn("未找到数字");
                clearInterval(interval);
                chrome.runtime.sendMessage({ type: "AI_DONE", score: "?", details: text });
            }
        }
    }, 1000);
}