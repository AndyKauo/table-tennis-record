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
add sheety
Retrieve rows from your sheet
https://api.sheety.co/34f676126a9603f83a4a060ee3b5df9c/tableTennisRecords/t1
let url = 'https://api.sheety.co/34f676126a9603f83a4a060ee3b5df9c/tableTennisRecords/t1';
fetch(url)
.then((response) => response.json())
.then(json => {
  // Do something with the data
  console.log(json.t1S);
});


Add a row to your sheet
https://api.sheety.co/34f676126a9603f83a4a060ee3b5df9c/tableTennisRecords/t1
let url = 'https://api.sheety.co/34f676126a9603f83a4a060ee3b5df9c/tableTennisRecords/t1';
  let body = {
    t1: {
      ...
    }
  }
  fetch(url, {
    method: 'POST',
    body: JSON.stringify(body)
  })
  .then((response) => response.json())
  .then(json => {
    // Do something with object
    console.log(json.t1);
  });
Edit a row in your sheet
https://api.sheety.co/34f676126a9603f83a4a060ee3b5df9c/tableTennisRecords/t1/[Object ID]
let url = 'https://api.sheety.co/34f676126a9603f83a4a060ee3b5df9c/tableTennisRecords/t1/2';
let body = {
  t1: {
    ...
  }
}
fetch(url, {
  method: 'PUT',
  body: JSON.stringify(body)
})
.then((response) => response.json())
.then(json => {
  // Do something with object
  console.log(json.t1);
});

Delete a row in your sheet
https://api.sheety.co/34f676126a9603f83a4a060ee3b5df9c/tableTennisRecords/t1/[Object ID]
let url = 'https://api.sheety.co/34f676126a9603f83a4a060ee3b5df9c/tableTennisRecords/t1/2';
fetch(url, {
  method: 'DELETE',
})
.then((response) => response.json())
.then(() => {
  console.log('Object deleted');
});

