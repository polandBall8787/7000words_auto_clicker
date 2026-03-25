let questionBank = [];
let autoAnswerInterval = null;
let lastQuestion = "";
let isWaitingToClick = false;

// 替換原本的 isRedirecting，這個鎖更全面，用來防止所有「換頁、跳轉、重整」期間的重複動作
let isProcessingNextStep = false; 

// --- 1. 啟動初始化 ---
chrome.storage.local.get(['isAutoEnabled'], (res) => {
    if (res.isAutoEnabled) {
        console.log("偵測到自動模式為開啟狀態，準備啟動...");
        startAutomation();
    }
});

// --- 2. 啟動邏輯 ---
async function startAutomation() {
    const success = await loadAllBanks();
    if (success && questionBank.length > 0) {
        if (autoAnswerInterval) clearInterval(autoAnswerInterval);
        console.log("=== 掛機模式已啟動 ===");
        autoAnswerInterval = setInterval(checkAndAnswer, 500);
    }
}

// --- 3. 自動設定與開始邏輯 ---
function AutoChooseUnit() {
    if (isProcessingNextStep) return;
    const currentUrl = window.location.href;

    if (currentUrl.includes("challenge-config")) {
        let unitCheckbox = document.querySelector('input[name="selected_units"][value="498"]');
        let startBtn = document.getElementById("start-btn");

        if (unitCheckbox && !unitCheckbox.checked) {
            unitCheckbox.checked = true;
            unitCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
            console.log("✅ 已自動勾選單元 498");
        }

        if (startBtn) {
            console.log("🚀 偵測到設定頁面，準備開始挑戰...");
            isProcessingNextStep = true; // 鎖上！防止 0.5 秒後又點一次
            startBtn.click();
            
            // 給網頁 3 秒鐘的時間跳轉，跳轉後這裡其實會隨著網頁重整而被清除，但加著比較保險
            setTimeout(() => { isProcessingNextStep = false; }, 3000);
        }
    }
}

// --- 4. 偵測「再測一次」按鈕 ---
function checkRetryButton() {
    if (isProcessingNextStep) return false; // 如果已經在處理了，就不要再派新任務

    const buttons = document.querySelectorAll('button');
    for (let btn of buttons) {
        let text = btn.innerText || btn.textContent || ""; // 雙重保險抓文字
        
        // 確保按鈕文字正確，而且是「在畫面上看得見」的狀態 (offsetParent !== null)
        if (text.includes("再測一次") && btn.offsetParent !== null) {
            console.log("🎯 偵測到測驗結束，等待 3 秒後自動再測一次...");
            isProcessingNextStep = true; // 鎖上！停止其他的答題或點擊動作
            
            setTimeout(() => {
                btn.click();
                console.log("✔️ 已點擊再測一次");
                // 點下去之後會重整網頁，多鎖 5 秒避免出錯
                setTimeout(() => { isProcessingNextStep = false; }, 5000);
            }, 3000);
            return true;
        }
    }
    return false;
}

// --- 5. 題庫載入 ---
async function loadAllBanks() {
    if (questionBank.length > 0) return true;
    console.log("正在載入 JSON 題庫...");
    let promises = [];
    for (let l = 1; l <= 6; l++) {
        let maxU = (l === 6) ? 20 : 21;
        for (let u = 1; u <= maxU; u++) {
            const file = `bank/quiz_history_L${l}_U${u}.json`;
            let p = chrome.runtime.sendMessage({ action: "fetchJSON", file: file })
                .then(res => (res && res.success) ? res.data : [])
                .catch(() => []);
            promises.push(p);
        }
    }
    const results = await Promise.all(promises);
    questionBank = results.flat();
    console.log(`題庫載入完成，共 ${questionBank.length} 筆資料。`);
    return questionBank.length > 0;
}

// --- 6. 核心答題邏輯 (支援多重答案) ---
function checkAndAnswer() {
    if (checkRetryButton()) return; 

    const currentUrl = window.location.href;
    if (currentUrl.includes("challenge-config")) {
        AutoChooseUnit();
        return;
    }

    if (isWaitingToClick || isProcessingNextStep) return;

    let questionElement = document.getElementById("question-text") || document.querySelector("h2");
    if (!questionElement) return;

    let questionText = questionElement.innerText.trim();
    if (questionText === lastQuestion || questionText === "") return;

    // 注意：這裡拿到的會是一個「答案陣列」
    const possibleAnswers = findAnswer(questionText);
    if (!possibleAnswers || possibleAnswers.length === 0) return;

    isWaitingToClick = true;
    const randomDelay = Math.floor(Math.random() * 1000) + 1500; 

    // 印出所有可能的答案，方便我們在 Console 觀察
    console.log(`🤔 題目: ${questionText} -> 可能的答案: [${possibleAnswers.join(", ")}]`);

    setTimeout(() => {
        let optionButtons = document.querySelectorAll(".option-btn, .quiz-option, button");
        let hasClicked = false;

        for (let btn of optionButtons) {
            let span = btn.querySelector("span");
            let optionText = (span ? span.innerText : btn.innerText).trim();

            // 檢查該選項是否符合我們找到的「任何一個」可能答案
            let isMatch = possibleAnswers.some(ans => optionText === ans || optionText.includes(ans));

            if (isMatch) {
                btn.click();
                lastQuestion = questionText;
                hasClicked = true;
                break;
            }
        }

        // 防呆機制：如果真的找不到對應的按鈕，把它標記為已處理，避免無限卡死
        if (!hasClicked) {
            console.warn(`⚠️ 畫面上找不到這些選項: ${possibleAnswers.join(", ")}，直接跳過這題！`);
            lastQuestion = questionText; 
        }

        isWaitingToClick = false;
    }, randomDelay);
}

// --- 7. 強化比對邏輯 (回傳陣列) ---
function findAnswer(questionText) {
    const clean = (s) => (s || "").toString().replace(/\s+/g, '').replace(/[\(\（].*?[\)\）]/g, '').toLowerCase();
    const target = clean(questionText);

    // 把原本的 .find() 改成 .filter()，把「所有」符合條件的題庫抓出來
    let matches = questionBank.filter(item => clean(item.question) === target);
    
    if (matches.length === 0) {
        matches = questionBank.filter(item => clean(item.question).includes(target) || target.includes(clean(item.question)));
    }

    if (matches.length > 0) {
        // 利用 Set 去除重複的答案，並整理成乾淨的陣列回傳
        // 例如：["someone", "somebody", "someone"] -> ["someone", "somebody"]
        return [...new Set(matches.map(m => m.answer.trim()))];
    }
    
    return null;
}

// --- 8. 訊息監聽器 ---
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "toggleAuto") {
        if (req.state === true) {
            chrome.storage.local.set({ isAutoEnabled: true }, () => startAutomation());
        } else {
            chrome.storage.local.set({ isAutoEnabled: false }, () => {
                clearInterval(autoAnswerInterval);
                autoAnswerInterval = null;
            });
        }
        sendResponse({ status: "ok" });
    }
    if (req.action === "getStatus") {
        sendResponse({ isRunning: autoAnswerInterval !== null });
    }
    return true;
});