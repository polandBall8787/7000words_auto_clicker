// 1. 變數宣告
let questionBank = [];
let lastLoadedConfig = ""; // 用來紀錄上次載入的 Level+Units，避免重複讀取

// 2. 核心：載入多個 JSON 題庫
async function loadQuestionBank(level, units) {
    const configKey = level + units.join(',');

    // 如果配置沒變且題庫已有資料，直接回傳
    if (lastLoadedConfig === configKey && questionBank.length > 0) {
        return questionBank;
    }

    console.log(`正在請求讀取 ${level} 的單元: ${units.join(', ')}`);
    questionBank = [];

    // 建立所有檔案的讀取請求
    const fetchPromises = units.map(unit => {
        const file = `bank/quiz_history_${level}_${unit}.json`;
        return chrome.runtime.sendMessage({
            action: "fetchJSON",
            file: file
        }).then(response => {
            if (response && response.success) {
                return response.data;
            } else {
                console.warn(`讀取 ${file} 失敗:`, response ? response.error : "未知錯誤");
                return [];
            }
        });
    });

    try {
        const results = await Promise.all(fetchPromises);
        // 將所有單元的題目合併成一個陣列
        questionBank = results.flat();
        lastLoadedConfig = configKey;
        console.log("題庫載入完成，總題數：", questionBank.length);
    } catch (err) {
        console.error("題庫合併讀取失敗:", err);
    }

    return questionBank;
}

// 3. 查找答案邏輯 (保持你的標準化邏輯)
function findAnswer(questionText, bank) {
    const normalize = (str) => {
        return str.replace(/\s+/g, '')
            .replace(/\(.*\)/g, '')
            .replace(/（.*）/g, '')
            .replace(/；/g, ';')
            .toLowerCase();
    };

    const target = normalize(questionText);
    for (let item of bank) {
        if (normalize(item.question) === target) {
            return item.answer.trim();
        }
    }
    return null;
}

// 4. 監聽來自 Popup 的點擊指令
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "startAutoAnswer") {
        (async () => {
            try {
                // 1. 取得題目元素
                let questionElement = document.querySelector("h2");
                if (!questionElement) return;

                let questionText = questionElement.innerText.trim();

                // 2. 根據 Popup 傳來的 level 和 units 載入題庫
                // 注意：req.level 和 req.units 由 Popup 傳送過來
                const bank = await loadQuestionBank(req.level, req.units);

                // 3. 找答案
                const answer = findAnswer(questionText, bank);
                if (!answer) {
                    console.log("題庫中找不到答案:", questionText);
                    return;
                }

                // 4. 選項匹配與點擊
                let optionButtons = document.querySelectorAll(".option-btn");
                for (let btn of optionButtons) {
                    let span = btn.querySelector("span");
                    let optionText = span ? span.innerText.trim() : btn.innerText.trim();

                    if (optionText === answer) {
                        btn.click();
                        break;
                    }
                }
            } catch (err) {
                console.error("自動答題發生錯誤:", err);
            }
        })();
        return true;
    }
});