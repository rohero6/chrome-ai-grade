// content_school.js (只提取链接版)
console.log("阅卷助手 v3.2 (URL提取版) 已加载");

let config = { isGrading: false, autoGrading: false };

// 1. 获取图片URL列表
function getStudentAnswerImageUrls() {
    const imgElements = document.querySelectorAll('div[ng-repeat="img in imgs"] img[ng-src], img[src^="http"]');
    const urls = [];
    imgElements.forEach(img => {
        let src = img.getAttribute('ng-src') || img.src;
        if (src) {
            // 确保是绝对路径
            if (src.startsWith('//')) src = 'http:' + src;
            urls.push(src.split('?')[0]);
        }
    });
    return Array.from(new Set(urls)); // 去重
}

async function startGrading() {
    if (config.isGrading) return;

    // 读取配置
    chrome.storage.local.get(['subject', 'standard'], (settings) => {
        const subject = settings.subject || "通用";
        const standard = settings.standard || "无具体标准";
        const imageUrls = getStudentAnswerImageUrls();

        if (imageUrls.length === 0) {
            alert("未检测到图片链接！");
            return;
        }

        config.isGrading = true;
        updateStatusBtn("🔄 请求后台下载...");

        // 【关键修改】只发送 URL 给后台，让后台去下载
        chrome.runtime.sendMessage({
            type: "DOWNLOAD_AND_GRADE_REQUEST", // 新指令
            imageUrls: imageUrls,
            subject: subject,
            standard: standard
        });
    });
}

// UI 注入逻辑保持不变
function injectUI() {
    const div = document.createElement('div');
    div.style.cssText = "position:fixed; top:10px; right:10px; z-index:99999; background:white; padding:10px; border:2px solid #333; border-radius:5px; box-shadow: 0 0 10px rgba(0,0,0,0.2);";
    div.innerHTML = `
        <div style="margin-bottom:5px; font-weight:bold;">AI 阅卷 v3.2</div>
        <button id="ai-start-btn" style="background:#4CAF50; color:white; padding:5px 10px; border:none; cursor:pointer;">开始判分</button>
        <div id="ai-status" style="margin-top:5px; color:#666; font-size:12px;">准备就绪</div>
    `;
    document.body.appendChild(div);
    document.getElementById('ai-start-btn').onclick = () => { config.isGrading = false; startGrading(); };
}

function updateStatusBtn(text) {
    const el = document.getElementById('ai-status');
    if (el) el.innerText = text;
}

// 接收结果
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "GRADE_RESULT") {
        updateStatusBtn(`AI 评分: ${msg.score}`);
        alert(`建议得分：${msg.score}\n\n${msg.details.substring(0, 60)}...`);
        config.isGrading = false;

        // 自动点击分数逻辑 (保留)
        // autoClickScore(msg.score);
    }
    if (msg.type === "ERROR") {
        updateStatusBtn("❌ 出错");
        alert(msg.message);
        config.isGrading = false;
    }
});

setTimeout(injectUI, 1500);