// background.js (下载代理版)

// 工具：下载 URL 并转 Base64
async function fetchImageAndConvertToBase64(url) {
    try {
        const response = await fetch(url); // 后台 fetch 不受 Mixed Content 限制
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
    // 1. 处理新的“下载并评分”请求
    if (request.type === "DOWNLOAD_AND_GRADE_REQUEST") {
        console.log("后台收到 URL，准备下载:", request.imageUrls);
        const sourceTabId = sender.tab.id; // 记住是谁发的请求

        // 并发下载所有图片
        Promise.all(request.imageUrls.map(url => fetchImageAndConvertToBase64(url)))
            .then(base64List => {
                const validImages = base64List.filter(img => img !== null);

                if (validImages.length === 0) {
                    chrome.tabs.sendMessage(sourceTabId, { type: "ERROR", message: "后台图片下载失败，请检查网络" });
                    return;
                }

                // 下载完成，寻找 Kimi
                findKimiAndSendTask(validImages, request, sourceTabId);
            });
    }

    // 2. 之前的 AI 完成逻辑
    if (request.type === "AI_DONE") {
        console.log("AI 完成:", request.score);
        // 广播结果 (简单起见，发给所有相关页面)
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.url.includes("wxy100.com")) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: "GRADE_RESULT",
                        score: request.score,
                        details: request.details
                    });
                }
            });
        });
    }
});

function findKimiAndSendTask(imagesBase64, request, sourceTabId) {
    chrome.tabs.query({ url: ["*://kimi.com/*", "*://www.kimi.com/*"] }, (tabs) => {
        if (tabs.length > 0) {
            const aiTabId = tabs[0].id;
            chrome.tabs.sendMessage(aiTabId, {
                type: "DO_AI_TASK",
                imagesBase64: imagesBase64,
                subject: request.subject,
                standard: request.standard
            }).catch(() => {
                chrome.tabs.sendMessage(sourceTabId, { type: "ERROR", message: "连接 Kimi 失败，请刷新 Kimi 页面" });
            });
        } else {
            chrome.tabs.sendMessage(sourceTabId, { type: "ERROR", message: "未找到 Kimi.com 网页" });
        }
    });
}