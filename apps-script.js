// 桌球記錄系統 Google Apps Script API
// 請將此程式碼貼到 script.google.com 的專案中

// 設定你的Google Sheets ID (請替換為你的實際ID)
const SHEET_ID = '1y4o8XYv8KfcyKn11fDNxZSHp2rLILDXjiQLstvkvYDQ/';
const SHEET_NAME = 't1';

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    
    // 獲取所有資料
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    if (values.length <= 1) {
      const result = { t1: [] };
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 第一列是標題
    const headers = values[0];
    const data = values.slice(1);
    
    // 轉換為物件陣列
    const records = data.map((row, index) => {
      const record = { id: index + 1 };
      headers.forEach((header, colIndex) => {
        record[header] = row[colIndex] || '';
      });
      return record;
    });
    
    const result = { t1: records };
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    const result = { 
      error: error.toString(),
      message: '讀取資料失敗' 
    };
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    
    // 檢查是否為刪除請求
    if (e.parameter && e.parameter.action === 'delete') {
      return handleDelete(e.parameter.id, sheet);
    }
    
    // 處理FormData或JSON
    let requestData;
    if (e.parameter && e.parameter.data) {
      // FormData方式
      requestData = JSON.parse(e.parameter.data);
    } else if (e.postData && e.postData.contents) {
      // JSON方式
      requestData = JSON.parse(e.postData.contents);
    } else {
      throw new Error('無效的請求資料格式');
    }
    
    const matchData = requestData.t1;
    
    // 檢查是否有標題行
    const range = sheet.getDataRange();
    if (range.getNumRows() === 0) {
      // 建立標題行
      const headers = [
        'date', 'opponentSchool', 'matchType', 'ourPlayers', 
        'opponentPlayers', 'scores', 'result', 'notes', 'timestamp'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // 獲取標題行
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // 建立新資料行
    const newRow = headers.map(header => matchData[header] || '');
    
    // 新增到工作表
    sheet.appendRow(newRow);
    
    // 獲取新增的行號
    const lastRow = sheet.getLastRow();
    const newRecord = { id: lastRow - 1, ...matchData };
    
    const result = { t1: newRecord };
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    const result = { 
      error: error.toString(),
      message: '新增資料失敗: ' + error.message
    };
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 處理刪除請求
function handleDelete(idParam, sheet) {
  try {
    const id = parseInt(idParam);
    
    if (!id || id < 1) {
      throw new Error('無效的ID');
    }
    
    // 刪除對應行 (ID+1因為第一行是標題)
    const rowToDelete = id + 1;
    
    if (rowToDelete <= sheet.getLastRow()) {
      sheet.deleteRow(rowToDelete);
    }
    
    const result = { 
      success: true, 
      message: '刪除成功',
      deletedId: id 
    };
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    const result = { 
      error: error.toString(),
      message: '刪除失敗: ' + error.message
    };
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
