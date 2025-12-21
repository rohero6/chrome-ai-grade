console.log("阅卷助手 v7.0 (双窗口自动循环版) 已加载");

let config = {
    isGrading: false,
    autoGrading: false // 默认关闭，在界面上勾选开启
};

// 1. 获取图片URL列表
function getStudentAnswerImageUrls() {
    // 适配你们系统的图片逻辑
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

async function startGrading() {
    if (config.isGrading) return;

    // 读取配置
    chrome.storage.local.get(['subject', 'standard'], (settings) => {
        const subject = settings.subject || "通用";
        const standard = settings.standard || "无具体标准";
        const imageUrls = getStudentAnswerImageUrls();

        if (imageUrls.length === 0) {
            console.warn("未检测到图片，可能是加载慢，稍等...");
            // 如果开启了自动模式，可以尝试重试几次
            if (config.autoGrading) setTimeout(startGrading, 1000);
            return;
        }

        config.isGrading = true;
        updateStatusBtn("🚀 正在评分...");

        // 发送给后台下载
        chrome.runtime.sendMessage({
            type: "DOWNLOAD_AND_GRADE_REQUEST",
            imageUrls: imageUrls,
            subject: subject,
            standard: standard
        });
    });
}

// 接收 AI 结果
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "GRADE_RESULT") {
        updateStatusBtn(`AI 给分: ${msg.score}`);

        // 1. 自动填分/点击分数按钮
        const success = autoClickScore(msg.score);

        // 2. 如果开启了连续模式，且填分成功
        if (config.autoGrading) {
            if (success) {
                updateStatusBtn("⏳ 3秒后下一题...");
                setTimeout(() => {
                    goToNextQuestionAndLoop();
                }, 3000); // 给老师留 3 秒看一眼分数，如果不满意可以手动改
            } else {
                alert(`AI 判了 ${msg.score} 分，但我没找到对应按钮，请手动处理。`);
                config.isGrading = false;
            }
        } else {
            // 非自动模式，结束
            config.isGrading = false;
            // alert(`建议得分：${msg.score}\n理由：${msg.details.substring(0, 50)}...`);
        }
    }

    if (msg.type === "ERROR") {
        updateStatusBtn("❌ 出错暂停");
        alert("出错：" + msg.message);
        config.isGrading = false;
        // 出错时自动停止循环，防止无限报错
        document.getElementById('ai-auto-check').checked = false;
        config.autoGrading = false;
    }
});

// --- 循环核心逻辑 ---

function autoClickScore(score) {
    // 你的打分按钮选择器 (根据你之前的代码 btn6 等)
    // 尝试找数字完全匹配的按钮
    const buttons = document.querySelectorAll('.scoreBtnList .btn6, .scoreBtnList span, button');
    for (let btn of buttons) {
        // 移除空格后比较
        if (btn.innerText.trim() === String(score)) {
            console.log("自动点击分数:", score);
            btn.click();
            // 很多系统需要双击或者触发 input
            btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            return true;
        }
    }
    console.error("找不到分数按钮:", score);
    return false;
}

function goToNextQuestionAndLoop() {
    // 1. 记录当前图片特征 (用于判断是否翻页成功)
    const oldImages = JSON.stringify(getStudentAnswerImageUrls());

    // 2. 点击下一题
    // 【请修改这里】你需要找到你们系统“下一题”按钮的 class 或 id
    // 常见写法：
    let nextBtn = document.querySelector('.next-btn') ||
        document.querySelector('button[ng-click*="next"]') ||
        document.querySelector('.icon-next'); // 瞎猜的，你需要F12看一下

    // 如果实在找不到按钮，有些系统是打完分自动跳下一题的，那就不用点
    if (nextBtn) {
        nextBtn.click();
        console.log("点击了下一题...");
    } else {
        console.log("未找到下一题按钮，假设系统自动跳转...");
    }

    // 3. 等待翻页完成 (侦测图片变化)
    updateStatusBtn("🔄 等待加载...");
    waitForImageChange(oldImages);
}

function waitForImageChange(oldImagesStr) {
    let checkCount = 0;
    const interval = setInterval(() => {
        checkCount++;
        const newImages = getStudentAnswerImageUrls();
        const newImagesStr = JSON.stringify(newImages);

        // 如果图片变了，且不是空的
        if (newImages.length > 0 && newImagesStr !== oldImagesStr) {
            clearInterval(interval);
            console.log("✅ 检测到新题目，开始评分！");
            config.isGrading = false; // 解锁状态
            startGrading(); // 递归调用，开始下一轮
        }

        if (checkCount > 20) { // 20秒没刷出来
            clearInterval(interval);
            updateStatusBtn("⚠️ 翻页超时");
            config.isGrading = false;
        }
    }, 1000);
}

// --- UI 部分 ---
function injectUI() {
    const div = document.createElement('div');
    div.style.cssText = "position:fixed; top:60px; right:20px; z-index:99999; background:white; padding:15px; border-radius:8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: sans-serif;";
    div.innerHTML = `
        <div style="margin-bottom:10px; font-weight:bold; color:#333;">🤖 AI 阅卷 v7.0</div>
        <div style="margin-bottom:10px;">
            <label style="cursor:pointer; display:flex; align-items:center;">
                <input type="checkbox" id="ai-auto-check" style="margin-right:8px; transform: scale(1.2);"> 
                开启全自动循环
            </label>
        </div>
        <button id="ai-start-btn" style="width:100%; background:#1a73e8; color:white; padding:8px; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">开始当前题</button>
        <div id="ai-status" style="margin-top:10px; color:#666; font-size:12px; text-align:center;">准备就绪 (需双窗口)</div>
    `;
    document.body.appendChild(div);

    document.getElementById('ai-start-btn').onclick = () => {
        config.isGrading = false;
        startGrading();
    };

    document.getElementById('ai-auto-check').onchange = (e) => {
        config.autoGrading = e.target.checked;
        if (config.autoGrading) {
            alert("⚠️ 开启后，AI 打分完会自动跳转下一题。\n请确保 Kimi 窗口一直打开且可见！");
        }
    };
}

function updateStatusBtn(text) {
    const el = document.getElementById('ai-status');
    if (el) el.innerText = text;
}

setTimeout(injectUI, 1500);