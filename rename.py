import os
import re

folder_path = "./bank"  # 你的 JSON 檔案所在的資料夾

if not os.path.exists(folder_path):
    print("找不到資料夾！")
else:
    files = os.listdir(folder_path)
    print("正在校正 Level 與 Unit 編號...")

    for filename in files:
        # 匹配舊的格式：quiz_history_L1_U(數字).json
        match = re.search(r'quiz_history_L1_U(\d+)\.json', filename)
        
        if match:
            total_unit = int(match.group(1)) # 取得目前的 U 數字 (例如 22 或 43)
            
            # --- 核心邏輯：每 21 個歸為一類 ---
            # 這裡用 (數字-1) 是為了讓 21 能除盡，最後再加回來
            new_level = ((total_unit - 1) // 21) + 1
            new_unit = ((total_unit - 1) % 21) + 1
            
            new_name = f"quiz_history_L{new_level}_U{new_unit}.json"
            
            old_path = os.path.join(folder_path, filename)
            new_path = os.path.join(folder_path, new_name)
            
            # 只有當名字不一樣時才改名，避免報錯
            if filename != new_name:
                os.rename(old_path, new_path)
                print(f"修正：{filename} -> {new_name}")

    print("\n🎉 校正完畢！現在 L1 只會有 U1~U21，U22 會自動變成 L2_U1。")