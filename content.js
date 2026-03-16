let questionBank = [];
let autoAnswerInterval = null;
let lastQuestion = ""; 
let isWaitingToClick = false; // 新增：正在「思考」的鎖，避免同一題重複點擊

// 1. 載入全部題庫
async function loadAllBanks() {
    if (questionBank.length > 0) return true; 
    console.log("開始載入單字庫...");
    let promises = [];

    for (let l = 1; l <= 6; l++) {
        let maxU = (l === 6) ? 20 : 21; 
        for (let u = 1; u <= maxU; u++) {
            const file = `bank/quiz_history_L${l}_U${u}.json`;
            let p = chrome.runtime.sendMessage({ action: "fetchJSON", file: file })
                .then(res => {
                    if (res && res.success) return res.data;
                    return []; 
                })
                .catch(() => []); 
            promises.push(p);
        }
    }

    try {
        const results = await Promise.all(promises);
        questionBank = results.flat();
        console.log(`全部題庫載入完成！總共 ${questionBank.length} 題。`);
        return true;
    } catch (err) {
        console.error("載入失敗:", err);
        return false;
    }
}

// 2. 查找答案邏輯 (標準化字串)
// 2. 強化版查找答案邏輯
function findAnswer(questionText) {
    const normalize = (str) => {
        if (!str) return "";
        return str
            .replace(/\s+/g, '')        // 移除所有空格（半形 & 全形）
            .replace(/[\r\n]+/g, '')    // 移除所有換行符 (\n, \r)
            .replace(/\(.*\)/g, '')     // 移除 ( ) 及其內容
            .replace(/（.*）/g, '')    // 移除 （ ） 及其內容
            .replace(/；/g, ';')         // 統一分號
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // 移除所有英文標點符號
            .toLowerCase()              // 轉小寫
            .trim();
    };

    const target = normalize(questionText);
    console.log("🔍 正在尋找標準化題目：", target);
    
    // 除錯模式：如果找不到，可以在 Console 印出目前的目標
    // console.log("🔍 正在尋找標準化題目：", target);

    for (let item of questionBank) {
        if (normalize(item.question) === target) {
            return item.answer.trim();
        }
    }
    return null;
}

// 3. 執行答題動作 (加入隨機延遲)
function checkAndAnswer() {
    // 如果系統正在「思考倒數」，就直接跳出，不要重複抓取
    if (isWaitingToClick) return; 

    let questionElement = document.querySelector("h2");
    if (!questionElement) return;

    let questionText = questionElement.innerText.trim();
    
    // 如果題目跟上次一樣（剛點完或正在過場動畫），跳過
    if (questionText === lastQuestion || questionText === "") return;

    const answer = findAnswer(questionText);
    if (!answer) {
        console.log("題庫中找不到答案:", questionText);
        return;
    }

    // === 發現新題目！開始啟動隨機等待 ===
    isWaitingToClick = true; // 上鎖，表示正在處理這一題
    
    // 💡 這裡可以自訂你的「假裝思考時間」範圍 (單位：毫秒)
    const minTime = 2200; // 最快 2.2 秒
    const maxTime = 4500; // 最慢 4.5 秒
    const randomDelay = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    
    console.log(`🤔 發現新題目：「${questionText}」，假裝思考 ${(randomDelay/1000).toFixed(1)} 秒...`);

    // 設定定時炸彈，時間到才點擊
    setTimeout(() => {
        let optionButtons = document.querySelectorAll(".option-btn");
        let found = false;
        
        for (let btn of optionButtons) {
            let span = btn.querySelector("span");
            let optionText = span ? span.innerText.trim() : btn.innerText.trim();

            if (optionText === answer) {
                btn.click();
                console.log("✔️ 自動點擊:", answer);
                lastQuestion = questionText; // 紀錄已答過的題目
                found = true;
                break;
            }
        }
        
        if (!found) console.log("網頁選項中沒看到這個答案");
        
        // 點擊完成後解鎖，讓主程式繼續偵測下一題
        isWaitingToClick = false;
        
    }, randomDelay);
}

// 4. 接收 Popup 傳來的啟動/停止訊號
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "getStatus") {
        // 如果 interval 存在，代表正在掛機中
        sendResponse({ isRunning: autoAnswerInterval !== null });
        return true; 
    }
    if (req.action === "toggleAuto") {
        if (req.state === true) {
            // 啟動模式
            (async () => {
                const success = await loadAllBanks();
                if (success && questionBank.length > 0) {
                    console.log("=== 掛機模式已啟動 ===");
                    isWaitingToClick = false;
                    lastQuestion = "";
                    // 我們把偵測頻率調快到 0.5 秒，這樣新題目一出來就能馬上發現，並開始倒數隨機時間
                    autoAnswerInterval = setInterval(checkAndAnswer, 500);
                } else {
                    alert("題庫載入失敗或無資料，請檢查 bank 資料夾！");
                }
            })();
        } else {
            // 停止模式
            console.log("=== 停止 ===");
            clearInterval(autoAnswerInterval);
            autoAnswerInterval = null;
            isWaitingToClick = false; // 強制解鎖
        }
        sendResponse({ status: "ok" });
    }
    return true;
});