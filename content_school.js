// content_school.js - 完整覆盖版
console.log("阅卷助手 v8.0 (自动循环版) 已加载");

let config = { isGrading: false, autoGrading: false };

// 获取图片URL
function getStudentAnswerImageUrls() {
    const imgElements = document.querySelectorAll('div[ng-repeat="img in imgs"] img[ng-src], img[src^="http"]');
    const urls = [];
    imgElements.forEach(img => {
        let src = img.getAttribute('ng-src') || img.src;
        if (src) {
            if (src.startsWith('//')) src = 'http:' + src;
            urls.push(src.split('?')[0]);
        }
    });
    return Array.from(new Set(urls));
}

// 开始流程
function startGrading() {
    if (config.isGrading) return;

    chrome.storage.local.get(['subject', 'standard'], (settings) => {
        const imageUrls = getStudentAnswerImageUrls();

        if (imageUrls.length === 0) {
            console.warn("没图，稍后再试...");
            if (config.autoGrading) setTimeout(startGrading, 1000);
            return;
        }

        config.isGrading = true;
        updateStatusBtn("🚀 切去 AI...");

        // 发送给后台 -> 后台会切去 Kimi
        chrome.runtime.sendMessage({
            type: "DOWNLOAD_AND_GRADE_REQUEST",
            imageUrls: imageUrls,
            subject: settings.subject || "通用",
            standard: settings.standard || "无标准"
        });
    });
}

// 接收结果 (此时页面刚刚被后台切回来)
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "GRADE_RESULT") {
        console.log("页面切回，分数:", msg.score);
        updateStatusBtn(`AI 给分: ${msg.score}`);

        const success = autoClickScore(msg.score);

        if (config.autoGrading && success) {
            updateStatusBtn("⏳ 下一题...");
            setTimeout(() => {
                goToNextQuestionAndLoop();
            }, 3000); // 留3秒给你看一眼
        } else {
            config.isGrading = false;
        }
    }

    if (msg.type === "ERROR") {
        alert("出错停止：" + msg.message);
        config.isGrading = false;
        config.autoGrading = false;
        document.getElementById('ai-auto-check').checked = false;
    }
});

function autoClickScore(score) {
    const buttons = document.querySelectorAll('.scoreBtnList .btn6, .scoreBtnList span, button');
    for (let btn of buttons) {
        if (btn.innerText.trim() === String(score)) {
            btn.click();
            btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            return true;
        }
    }
    return false;
}

function goToNextQuestionAndLoop() {
    const oldImages = JSON.stringify(getStudentAnswerImageUrls());

    // 【请确认这里】下一题按钮的选择器
    let nextBtn = document.querySelector('.next-btn') ||
        document.querySelector('[ng-click*="next"]') ||
        document.querySelector('.icon-next');

    if (nextBtn) nextBtn.click();
    else console.log("未找到下一题按钮，尝试等待自动翻页...");

    updateStatusBtn("🔄 加载中...");

    // 等翻页
    let checks = 0;
    const interval = setInterval(() => {
        checks++;
        const newImages = getStudentAnswerImageUrls();
        if (newImages.length > 0 && JSON.stringify(newImages) !== oldImages) {
            clearInterval(interval);
            config.isGrading = false;
            startGrading(); // 递归循环
        }
        if (checks > 20) { clearInterval(interval); config.isGrading = false; }
    }, 1000);
}

// UI
function injectUI() {
    const div = document.createElement('div');
    div.style.cssText = "position:fixed; top:60px; right:20px; z-index:99999; background:white; padding:15px; border-radius:8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: sans-serif;";
    div.innerHTML = `
        <div style="margin-bottom:10px; font-weight:bold;">AI 阅卷 v8.0</div>
        <label style="cursor:pointer; display:flex; align-items:center;">
            <input type="checkbox" id="ai-auto-check" style="margin-right:8px; transform: scale(1.2);"> 
            全自动循环 (自动切屏)
        </label>
        <button id="ai-start-btn" style="width:100%; margin-top:10px; background:#1a73e8; color:white; padding:8px; border:none; border-radius:4px; cursor:pointer;">开始判分</button>
        <div id="ai-status" style="margin-top:10px; color:#666; font-size:12px; text-align:center;">就绪</div>
    `;
    document.body.appendChild(div);

    document.getElementById('ai-start-btn').onclick = () => { config.isGrading = false; startGrading(); };
    document.getElementById('ai-auto-check').onchange = (e) => { config.autoGrading = e.target.checked; };
}
function updateStatusBtn(text) {
    const el = document.getElementById('ai-status');
    if (el) el.innerText = text;
}
setTimeout(injectUI, 1500);