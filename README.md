# 🏓 百齡國小桌球校隊比賽記錄系統 v9

一個完整的桌球比賽記錄管理系統，支援線上雲端同步和離線模式。

## ✨ 功能特色

- 📝 **比賽記錄管理** - 支援單打、雙打、團體賽
- ☁️ **雲端同步** - 自動同步至 Google Sheets
- 📱 **響應式設計** - 支援手機、平板、電腦
- 🔄 **離線模式** - 斷網時自動保存，復網後自動同步
- 📊 **統計分析** - 球員個人表現統計
- 📋 **歷史記錄** - 完整比賽歷史查詢
- 🗑️ **記錄管理** - 可編輯、刪除比賽記錄

## 🚀 快速開始

### 1. 設置 Google Sheets
1. 建立新的 Google Sheets 文件
2. 將工作表重新命名為 `t1`
3. 在第一列設置標題行：
   ```
   A1: date | B1: opponentSchool | C1: matchType | D1: ourPlayers 
   E1: opponentPlayers | F1: scores | G1: result | H1: notes | I1: timestamp
   ```

### 2. 部署 Google Apps Script
1. 前往 https://script.google.com
2. 建立新專案
3. 複製 `apps-script.js` 的程式碼
4. 修改 `SHEET_ID` 為你的 Google Sheets ID
5. 部署為網路應用程式
6. 複製部署 URL

### 3. 設定前端
1. 打開 `v9/script.js`
2. 修改第4行的 `apiUrl` 為你的 Apps Script URL
3. 開啟 `v9/index.html` 開始使用

## 📁 檔案結構
```
v9/
├── index.html      # 主頁面
├── script.js       # 核心功能
└── style.css       # 樣式表
apps-script.js      # Apps Script 後端程式碼
```

## 🛠️ 疑難排解
在瀏覽器控制台執行：
```javascript
diagnoseSheetsStructure()  // 診斷系統
manualSync()              // 手動同步
clearPendingMatches()     // 清理資料
```

---
**版本**: v9 | **更新**: 2025-08-03