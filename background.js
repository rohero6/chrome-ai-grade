// background.js - 完整覆盖版

let gradingTabId = null; // 记住改卷页面的 ID

// 辅助：后台下载图片转 Base64
async function fetchImageAndConvertToBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("后台下载失败:", url, e);
        return null;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // 1. 改卷页面发起请求 -> 切去 Kimi
    if (request.type === "DOWNLOAD_AND_GRADE_REQUEST") {
        console.log("收到改卷请求，准备下载并切到 Kimi...");
        gradingTabId = sender.tab.id; // 【关键】记下改卷页面 ID

        // 并发下载图片
        Promise.all(request.imageUrls.map(url => fetchImageAndConvertToBase64(url)))
            .then(base64List => {
                const validImages = base64List.filter(img => img !== null);

                if (validImages.length === 0) {
                    chrome.tabs.sendMessage(gradingTabId, { type: "ERROR", message: "图片下载失败，请检查网络" });
                    return;
                }

                // 下载完成，去找 Kimi 并切过去
                switchToKimiAndRun(validImages, request);
            });
    }

    // 2. Kimi 完成任务 -> 切回改卷页
    if (request.type === "AI_DONE_AND_SWITCH_BACK") {
        console.log("AI 完成，切回改卷页面...");

        if (gradingTabId) {
            // 先切回去
            chrome.tabs.update(gradingTabId, { active: true }, () => {
                // 再发消息 (延时一点点确保页面苏醒)
                setTimeout(() => {
                    chrome.tabs.sendMessage(gradingTabId, {
                        type: "GRADE_RESULT",
                        score: request.score,
                        details: request.details
                    });
                }, 200);
            });
        }
    }

    // 错误处理转发
    if (request.type === "ERROR") {
        if (gradingTabId) {
            chrome.tabs.sendMessage(gradingTabId, request);
            // 出错了也要切回去让用户看
            chrome.tabs.update(gradingTabId, { active: true });
        }
    }
});

function switchToKimiAndRun(imagesBase64, request) {
    // 查找 Kimi 标签页
    chrome.tabs.query({ url: ["*://kimi.com/*", "*://www.kimi.com/*"] }, (tabs) => {
        if (tabs.length > 0) {
            const kimiTabId = tabs[0].id;

            // 【核心动作】强制激活 Kimi 标签页！
            chrome.tabs.update(kimiTabId, { active: true }, () => {

                // 给页面 500ms 苏醒时间
                setTimeout(() => {
                    chrome.tabs.sendMessage(kimiTabId, {
                        type: "DO_AI_TASK",
                        imagesBase64: imagesBase64,
                        subject: request.subject,
                        standard: request.standard,
                        config: request.config // 只要把这个透传过去就行
                    });
                }, 500);
            });
        } else {
            if (gradingTabId) {
                chrome.tabs.sendMessage(gradingTabId, { type: "ERROR", message: "未找到 Kimi 网页，请先打开！" });
            }
        }
    });
}