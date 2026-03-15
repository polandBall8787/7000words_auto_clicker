// 監聽來自 content script 的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchJSON") {
        const url = chrome.runtime.getURL(request.file);
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                console.error("Background 讀取失敗:", error);
                sendResponse({ success: false, error: error.message });
            });
        
        return true; // 保持非同步通訊
    }
});