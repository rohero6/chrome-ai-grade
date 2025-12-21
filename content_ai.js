console.log("AI 阅卷助手：Kimi v5.0 (终极猎手版) 已就绪");

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

// 延时函数
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function handleKimiGrading(data) {
    console.log("🚀 [v5.0] 开始处理新题目:", data.subject);

    // 1. 记录初始气泡数量
    const bubblesSelector = 'div[class*="markdown"]';
    const initialCount = document.querySelectorAll(bubblesSelector).length;
    console.log(`📊 发送前气泡数量: ${initialCount}`);

    // 2. 找到输入框
    let editor = document.querySelector('div[contenteditable="true"]') || document.querySelector('#chat-input');
    if (!editor) { console.error("❌ 找不到输入框"); return; }

    // 聚焦并清空（防止残留）
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
        await sleep(800); // 等待图片预览
    }

    // 4. 填入文字 (强化版输入，确保激活按钮)
    const promptText = `
我需要你扮演阅卷老师。
【科目】：${data.subject}
【评分标准】：${data.standard}

请分析图片中的学生作答。
**重要：请严格按照标准打分，只返回一个数字分数，不要任何解释。**
    `;

    // 模拟真实输入
    document.execCommand('insertText', false, promptText);

    // 【关键】疯狂触发 Input 事件，唤醒发送按钮
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));

    // 甚至尝试修改 innerText 触发 React 绑定
    if (editor.innerText.trim() === "") {
        editor.innerText = promptText;
    }
    await sleep(500);

    // 5. 寻找并点击发送按钮
    const sendSuccess = await findAndClickSendButton();

    if (sendSuccess) {
        waitForNewResponse(initialCount);
    } else {
        console.error("❌ 最终发送失败");
        chrome.runtime.sendMessage({ type: "ERROR", message: "无法找到发送按钮，请检查页面结构" });
    }
}

/**
 * 🕵️ 终极找按钮逻辑：全屏扫描 + 特征匹配
 */
async function findAndClickSendButton() {
    console.log("🕵️ 开始全屏扫描发送按钮...");
    let attempts = 0;

    while (attempts < 15) { // 尝试 15 次 (约 7.5秒)
        attempts++;
        let targetBtn = null;

        // --- 方案 A: 精确选择器 (针对 Kimi 最新版) ---
        // 这里的选择器是根据你截图推测的最新结构
        const candidates = [
            'button[data-testid="send-button"]',    // 官方测试ID
            'button[aria-label="发送"]',            // 语义标签
            'div[class*="sendButton"]',             // 常见的类名结构
            'button[class*="send"]',                // 宽泛类名
            'div[role="button"][class*="send"]'     // Div 伪装的按钮
        ];

        for (let selector of candidates) {
            const el = document.querySelector(selector);
            if (el) {
                targetBtn = el;
                console.log(`✅ [方案A] 通过选择器找到按钮: ${selector}`);
                break;
            }
        }

        // --- 方案 B: 图标特征匹配 (如果方案 A 失败) ---
        // 查找所有 button，看谁里面包含 SVG 图标，且位置在右下角
        if (!targetBtn) {
            const allButtons = Array.from(document.querySelectorAll('button, div[role="button"]'));
            // 过滤：必须可见，且不能是文件上传按钮
            const visibleButtons = allButtons.filter(b => {
                const rect = b.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && !b.querySelector('input[type="file"]');
            });

            // 倒序查找（发送按钮通常是页面 DOM 里的最后一个功能按钮）
            for (let i = visibleButtons.length - 1; i >= 0; i--) {
                const btn = visibleButtons[i];
                // 检查是否包含 path 标签 (SVG 图标特征)
                if (btn.querySelector('svg') || btn.querySelector('path')) {
                    // 简单的位置判断：发送按钮通常在输入框附近，或者页面右下角区域
                    targetBtn = btn;
                    console.log("✅ [方案B] 通过 SVG 特征找到最后一个图标按钮", btn);
                    break;
                }
            }
        }

        // --- 执行点击 ---
        if (targetBtn) {
            // 检查是否置灰 (disabled)
            if (!targetBtn.disabled && !targetBtn.classList.contains('disabled') && targetBtn.getAttribute('aria-disabled') !== 'true') {
                console.log("🎯 按钮状态可用，点击！");
                targetBtn.click();
                await sleep(100);
                targetBtn.click(); // 双击保险
                return true;
            } else {
                console.log(`⏳ [第${attempts}次] 按钮找到了，但状态是不可用 (可能图片还在传)...`);
            }
        } else {
            console.log(`🔍 [第${attempts}次] 暂未找到按钮...`);
        }

        await sleep(500);
    }

    // --- 方案 C: 绝望的暴力回车 (带上 shiftKey: false 确保是发送) ---
    console.warn("⚠️ 按钮扫描失败，尝试 Shift+Enter 组合拳...");
    const editor = document.querySelector('div[contenteditable="true"]');
    if (editor) {
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, shiftKey: false }));
        return true; // 假装成功，去监听结果
    }

    return false;
}

function waitForNewResponse(oldBubbleCount) {
    console.log("⏳ 进入回复监听模式...");
    let checkCount = 0;
    let stableCount = 0;
    let lastTextLength = 0;

    const interval = setInterval(() => {
        checkCount++;
        const bubbles = document.querySelectorAll('div[class*="markdown"]');
        const currentCount = bubbles.length;

        // 阶段一：等待新气泡
        if (currentCount <= oldBubbleCount) {
            if (checkCount % 5 === 0) console.log(`...waiting (当前: ${currentCount}, 旧: ${oldBubbleCount})`);
            if (checkCount > 60) {
                console.error("❌ 超时：AI 没有生成新气泡");
                clearInterval(interval);
                chrome.runtime.sendMessage({ type: "ERROR", message: "AI 响应超时" });
            }
            return;
        }

        // 阶段二：等待内容生成
        const lastBubble = bubbles[bubbles.length - 1];
        const currentText = lastBubble.innerText;
        if (!currentText) return;

        if (currentText.length === lastTextLength && currentText.length > 0) {
            stableCount++;
        } else {
            stableCount = 0;
            console.log(`[生成中] len: ${currentText.length}`);
        }
        lastTextLength = currentText.length;

        if (stableCount >= 2) {
            console.log("✅ 内容稳定:", currentText);
            const scoreMatch = currentText.match(/(\d+)/);
            if (scoreMatch) {
                console.log("🎯 分数:", scoreMatch[0]);
                clearInterval(interval);
                chrome.runtime.sendMessage({ type: "AI_DONE", score: scoreMatch[0], details: currentText });
            } else {
                console.warn("未找到数字");
                clearInterval(interval);
                chrome.runtime.sendMessage({ type: "AI_DONE", score: "?", details: currentText });
            }
        }
    }, 1000);
}