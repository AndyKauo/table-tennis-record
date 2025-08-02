# 產生 README.md 檔案內容
readme_content = """
# 🏓 桌球校隊比賽記錄系統

這是一個簡單的前端系統，讓教練與球員可以記錄比賽、統計戰績與查看歷史紀錄。

## 🔗 線上預覽
👉 [點我查看系統](https://andykauo.github.io/table-tennis-record/)


---

## 📁 專案結構

- `index.html`：主要網頁框架
- `style.css`：頁面樣式
- `script.js`：前端互動邏輯與本地儲存

---

## ✅ 功能特色

- 紀錄比賽日期、對手學校、比分與備註
- 自動計算比賽勝負
- 球員統計：勝率、出賽次數
- 比賽歷史紀錄查詢
- 無需伺服器，資料儲存於使用者瀏覽器 `localStorage`

---

## 🛠️ 如何部署（選擇性）

若你想自己 fork 或修改：

```bash
git clone https://github.com/AndyKauo/table-tennis-record.git
cd table-tennis-record
# 開啟 index.html 即可
