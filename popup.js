document.addEventListener('DOMContentLoaded', async () => {
    const toggleBtn = document.getElementById('toggle_btn');
    const statusText = document.getElementById('status');
    let isRunning = false;

    // 取得當前分頁的函式
    async function getCurrentTab() {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    const tab = await getCurrentTab();

    // --- 1. 初始化：詢問 Content Script 狀態 ---
    if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: "getStatus" }, (res) => {
            // 檢查是否通訊成功
            if (chrome.runtime.lastError) {
                console.warn("尚未偵測到腳本，可能需要重新整理網頁。");
                statusText.innerText = "狀態：請整理網頁";
                return;
            }
            if (res && res.isRunning) {
                isRunning = true;
                updateUI(true);
            }
        });
    }

    // --- 2. 切換邏輯 ---
    toggleBtn.addEventListener('click', async () => {
        const currentTab = await getCurrentTab(); // 點擊時重新確認一次分頁
        if (!currentTab || !currentTab.id) return;

        isRunning = !isRunning;
        updateUI(isRunning);

        chrome.tabs.sendMessage(currentTab.id, {
            action: "toggleAuto",
            state: isRunning
        }, (response) => {
            if (chrome.runtime.lastError) {
                alert("通訊失敗！請重新整理目標網頁後再試一次。");
                updateUI(false);
                isRunning = false;
            }
        });
    });

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
});