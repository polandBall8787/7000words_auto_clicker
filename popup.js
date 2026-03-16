document.addEventListener('DOMContentLoaded', async () => {
    const toggleBtn = document.getElementById('toggle_btn');
    const statusText = document.getElementById('status');
    
    let isRunning = false;

    // --- 新增：初始化偵測 ---
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 主動問 Content Script 狀態
    chrome.tabs.sendMessage(tab.id, { action: "getStatus" }, (res) => {
        if (chrome.runtime.lastError) return; // 避免在非目標網頁出錯
        
        if (res && res.isRunning) {
            isRunning = true;
            updateUI(true); // 把更新介面的邏輯抽成函式比較乾淨
        }
    });

    // 把更新介面的樣子寫在一起，避免重複寫兩次
    function updateUI(running) {
        if (running) {
            toggleBtn.innerText = "停止自動答題";
            toggleBtn.classList.add("running");
            statusText.innerText = "狀態：掛機中 ⚡";
            statusText.className = "status-on";
        } else {
            toggleBtn.innerText = "啟動自動答題";
            toggleBtn.classList.remove("running");
            statusText.innerText = "狀態：已暫停";
            statusText.className = "status-off";
        }
    }

    toggleBtn.addEventListener('click', async () => {
        // 防呆：確認在目標網站
        if (!tab.url.includes("yh7000.org/quiz/play/")) {
            alert("請在測驗頁面中啟動外掛！");
            return;
        }

        isRunning = !isRunning;
        updateUI(isRunning); // 使用我們抽出來的函式

        chrome.tabs.sendMessage(tab.id, {
            action: "toggleAuto",
            state: isRunning
        });
    });
});