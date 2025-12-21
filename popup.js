document.addEventListener('DOMContentLoaded', () => {
    // 1. 加载已保存的设置
    chrome.storage.local.get(['subject', 'standard'], (result) => {
        if (result.subject) document.getElementById('subject').value = result.subject;
        if (result.standard) document.getElementById('standard').value = result.standard;
    });

    // 2. 保存设置
    document.getElementById('save').addEventListener('click', () => {
        const subject = document.getElementById('subject').value;
        const standard = document.getElementById('standard').value;

        chrome.storage.local.set({ subject, standard }, () => {
            const status = document.getElementById('status');
            status.style.display = 'block';
            setTimeout(() => status.style.display = 'none', 2000);
        });
    });
});