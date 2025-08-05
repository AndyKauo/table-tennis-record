// 桌球記錄系統 Google Apps Script API
// 請將此程式碼貼到 script.google.com 的專案中

// 設定你的Google Sheets ID (請替換為你的實際ID)
const SHEET_ID = '1y4o8XYv8KfcyKn11fDNxZSHp2rLILDXjiQLstvkvYDQ';
const SHEET_NAME = 't1';
const VISITOR_SHEET_NAME = 'visitors';

// 處理 CORS 預檢請求 - 使用兼容的方法
function doOptions(e) {
  const output = ContentService.createTextOutput('');
  output.setMimeType(ContentService.MimeType.TEXT);
  // 注意：舊版 Apps Script 不支援 setHeaders，改用 manifest 設定
  return output;
}

// 創建 JSON 回應（無法直接設定 CORS 標頭，需要在 manifest 中設定）
function createCORSResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    // 檢查是否為訪客記錄請求
    if (e.parameter && e.parameter.action === 'recordVisitor') {
      return handleVisitorRecordGet(e.parameter);
    }
    
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    
    // 獲取所有資料
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    if (values.length <= 1) {
      const result = { t1: [] };
      return createCORSResponse(result);
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
    
    return createCORSResponse(result);
      
  } catch (error) {
    const result = { 
      error: error.toString(),
      message: '讀取資料失敗' 
    };
    return createCORSResponse(result);
  }
}

function doPost(e) {
  try {
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
    
    // 檢查是否為訪客記錄請求
    if (requestData.action === 'recordVisitor') {
      return handleVisitorRecord(requestData.data);
    }
    
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    
    // 檢查是否為刪除請求
    if (e.parameter && e.parameter.action === 'delete') {
      return handleDelete(e.parameter.id, sheet);
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
    
    return createCORSResponse(result);
      
  } catch (error) {
    const result = { 
      error: error.toString(),
      message: '新增資料失敗: ' + error.message
    };
    return createCORSResponse(result);
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
    
    return createCORSResponse(result);
      
  } catch (error) {
    const result = { 
      error: error.toString(),
      message: '刪除失敗: ' + error.message
    };
    return createCORSResponse(result);
  }
}

// 處理訪客記錄請求 (GET 方式)
function handleVisitorRecordGet(params) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let visitorSheet = spreadsheet.getSheetByName(VISITOR_SHEET_NAME);
    
    // 如果訪客工作表不存在，建立它
    if (!visitorSheet) {
      visitorSheet = spreadsheet.insertSheet(VISITOR_SHEET_NAME);
      // 建立標題行
      visitorSheet.getRange(1, 1, 1, 3).setValues([['timestamp', 'userAgent', 'referrer']]);
    }
    
    // 新增訪客記錄
    visitorSheet.appendRow([
      params.timestamp || new Date().toISOString(),
      params.userAgent || 'Unknown',
      params.referrer || '直接訪問'
    ]);
    
    // 計算總訪客數（扣除標題行）
    const totalVisitors = Math.max(0, visitorSheet.getLastRow() - 1);
    
    const result = {
      success: true,
      totalVisitors: totalVisitors,
      message: '訪客記錄成功'
    };
    
    return createCORSResponse(result);
      
  } catch (error) {
    const result = {
      error: error.toString(),
      message: '訪客記錄失敗: ' + error.message
    };
    return createCORSResponse(result);
  }
}

// 處理訪客記錄請求 (POST 方式 - 保留以防需要)
function handleVisitorRecord(visitorData) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let visitorSheet = spreadsheet.getSheetByName(VISITOR_SHEET_NAME);
    
    // 如果訪客工作表不存在，建立它
    if (!visitorSheet) {
      visitorSheet = spreadsheet.insertSheet(VISITOR_SHEET_NAME);
      // 建立標題行
      visitorSheet.getRange(1, 1, 1, 3).setValues([['timestamp', 'userAgent', 'referrer']]);
    }
    
    // 新增訪客記錄
    visitorSheet.appendRow([
      visitorData.timestamp,
      visitorData.userAgent,
      visitorData.referrer
    ]);
    
    // 計算總訪客數（扣除標題行）
    const totalVisitors = Math.max(0, visitorSheet.getLastRow() - 1);
    
    const result = {
      success: true,
      totalVisitors: totalVisitors,
      message: '訪客記錄成功'
    };
    
    return createCORSResponse(result);
      
  } catch (error) {
    const result = {
      error: error.toString(),
      message: '訪客記錄失敗: ' + error.message
    };
    return createCORSResponse(result);
  }
}
