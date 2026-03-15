document.addEventListener('DOMContentLoaded', () => {
    const unitList = document.getElementById('unit-list');
    const levelSelect = document.getElementById('level');
    const loadBtn = document.getElementById('load_questions');
    const startBtn = document.getElementById('start_test');
    const reloadBtn = document.getElementById('reload');

    let questionBank = []; // 用於存放最終載入的題目

    /**
     * 1. 核心功能：生成 Unit 列表並自動檢查檔案
     * @param {string} level - 目前選中的 Level (L1-L6)
     */
    async function renderUnits(level) {
        unitList.innerHTML = ''; // 清空目前的列表

        // 根據規則：L6 只有 20 個 Unit，其餘 21 個
        const maxUnits = (level === 'L6') ? 20 : 21;

        for (let i = 1; i <= maxUnits; i++) {
            const unitValue = `U${i}`;
            const fileName = `bank/quiz_history_${level}_${unitValue}.json`;

            // 建立 UI 元素
            const label = document.createElement('label');
            label.className = 'checkbox-item';
            label.id = `label-${unitValue}`;
            label.innerHTML = `
        <input type="checkbox" value="${unitValue}">
        <span>Unit ${i}</span>
      `;
            unitList.appendChild(label);

            // 非同步檢查檔案是否存在
            checkFileStatus(fileName, label);
        }
    }

    /**
     * 2. 檔案掃描：若找不到檔案則標紅並禁用
     */
    async function checkFileStatus(url, element) {
        const checkbox = element.querySelector('input');
        try {
            const response = await fetch(url, { method: 'HEAD' });
            if (!response.ok) {
                throw new Error('File not found');
            }
        } catch (err) {
            element.classList.add('missing'); // CSS 會將此類別標為紅色
            checkbox.disabled = true;
            checkbox.checked = false;
        }
    }

    /**
     * 3. 載入題庫：抓取所有勾選的 JSON 內容
     */
    loadBtn.addEventListener('click', async () => {
        const selectedLevel = levelSelect.value;
        const selectedCheckboxes = document.querySelectorAll('#unit-list input:checked');

        if (selectedCheckboxes.length === 0) {
            alert('請先勾選可用的 Unit 單元！');
            return;
        }

        questionBank = []; // 重置題庫
        loadBtn.innerText = '載入中...';
        loadBtn.disabled = true;

        const fetchPromises = Array.from(selectedCheckboxes).map(cb => {
            const fileName = `bank/quiz_history_${selectedLevel}_${cb.value}.json`;
            return fetch(fileName)
                .then(res => res.json())
                .then(data => {
                    questionBank = questionBank.concat(data);
                })
                .catch(err => console.error(`讀取 ${fileName} 失敗:`, err));
        });

        await Promise.all(fetchPromises);

        loadBtn.innerText = '載入題庫';
        loadBtn.disabled = false;
        alert(`成功載入 ${questionBank.length} 個題目！`);
    });

    /**
     * 4. 事件監聽
     */

    // 切換 Level 時重新生成 Unit 列表
    levelSelect.addEventListener('change', () => {
        renderUnits(levelSelect.value);
    });

    // 重新整理頁面
    reloadBtn.addEventListener('click', () => {
        location.reload();
    });

    // 開始測驗（範例邏輯）
    // 在 Popup.js 裡面
    startBtn.addEventListener('click', async () => {
        const selectedLevel = levelSelect.value;
        const selectedUnits = Array.from(document.querySelectorAll('#unit-list input:checked'))
            .map(cb => cb.value);

        // 取得當前分頁並發送訊息
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.tabs.sendMessage(tab.id, {
            action: "startAutoAnswer",
            level: selectedLevel,
            units: selectedUnits
        });
    });
    // 5. 初始執行 (預設載入 L1)
    renderUnits('L1');
});