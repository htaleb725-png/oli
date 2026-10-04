/**
 * Google Apps Script Production Engine (سكربت الربط السحابي مع Google Sheets)
 * -------------------------------------------------------------------------
 * هذا الكود الجاهز يقوم المطور بنسخه ولصقه في Google Sheets:
 * الإضافات (Extensions) -> Apps Script -> لصق الكود -> نشر (Deploy) -> تطبيق ويب (Web App)
 * الصلاحية: Anyone (أي شخص)
 */

export const GOOGLE_APPS_SCRIPT_SOURCE = `/**
 * منظومة مكتب النائب علا الناشي - محرك مزامنة Google Sheets اللحظي
 * الإصدار 2026 - يدعم الأقسام المخصصة والبيانات اللحظية
 */

function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var tabs = [
    { name: 'سجل_المراجعين_Citizens', headers: ['Citizen_ID', 'FullName', 'Phone1', 'Phone2', 'District', 'SubDistrict', 'Gender', 'Rating', 'Job', 'Education', 'ReferralSource', 'CreatedAt', 'PhotoUrl'] },
    { name: 'طلبات_المواطنين_Requests', headers: ['Request_ID', 'Citizen_ID', 'CitizenName', 'Phone1', 'Entity', 'RequestStatus', 'ProcessingStatus', 'Priority', 'Details', 'CreatedAt', 'CreatedBy'] },
    { name: 'مقابلات_النائب_Interviews', headers: ['Interview_ID', 'Citizen_ID', 'CitizenName', 'Date', 'Status', 'CreatedAt'] },
    { name: 'الكتب_الرسمية_Letters', headers: ['Letter_ID', 'Letter_Number', 'Letter_Date', 'To_Entity', 'Subject', 'Recipient', 'Status', 'ClerkName'] },
    { name: 'صكوك_المساعدات_Cheques', headers: ['id', 'ChequeNumber', 'Citizen_ID', 'CitizenName', 'Amount', 'BankName', 'Purpose', 'Status', 'IssueDate', 'DueDate'] },
    { name: 'السجل_التنظيمي_Org', headers: ['Org_ID', 'Citizen_ID', 'Rating', 'UpdatedAt'] },
    { name: 'الأقسام_المخصصة_Sections', headers: ['id', 'title', 'description', 'icon', 'badgeColor', 'fieldsJson', 'createdAt'] },
    { name: 'سجلات_الأقسام_Records', headers: ['id', 'sectionId', 'dataJson', 'createdAt', 'createdBy'] }
  ];

  tabs.forEach(function(t) {
    var sheet = ss.getSheetByName(t.name);
    if (!sheet) {
      sheet = ss.insertSheet(t.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(t.headers);
      var headerRange = sheet.getRange(1, 1, 1, t.headers.length);
      headerRange.setBackground('#1e293b');
      headerRange.setFontColor('#f8fafc');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });

  return { status: 'success', message: 'تم تجهيز وتنسيق كافة الجداول بنجاح' };
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);
  
  try {
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action || 'sync';
    var table = contents.table;
    var data = contents.data;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ensure setup
    setupSpreadsheet();

    var targetSheetName = getSheetNameForTable(table);
    var sheet = ss.getSheetByName(targetSheetName);

    if (!sheet) {
      sheet = ss.insertSheet(targetSheetName);
    }

    if (action === 'insert' || action === 'upsert') {
      handleUpsert(sheet, table, data);
    } else if (action === 'delete') {
      handleDelete(sheet, table, data.id || data.Citizen_ID || data.Request_ID);
    } else if (action === 'bulk_sync') {
      handleBulkSync(ss, data);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'تمت المزامنة بنجاح في Google Sheets',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    return ContentService.createTextOutput(JSON.stringify({
      status: 'online',
      appName: 'منظومة مكتب النائب علا الناشي',
      spreadsheetName: ss.getName(),
      sheetsCount: ss.getSheets().length,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetNameForTable(table) {
  switch (table) {
    case 'citizens': return 'سجل_المراجعين_Citizens';
    case 'requests': return 'طلبات_المواطنين_Requests';
    case 'interviews': return 'مقابلات_النائب_Interviews';
    case 'letters': return 'الكتب_الرسمية_Letters';
    case 'cheques': return 'صكوك_المساعدات_Cheques';
    case 'organizations': return 'السجل_التنظيمي_Org';
    case 'custom_sections': return 'الأقسام_المخصصة_Sections';
    case 'custom_records': return 'سجلات_الأقسام_Records';
    default: return 'بيانات_' + (table || 'عامة');
  }
}

function handleUpsert(sheet, table, item) {
  var idCol = 1;
  var targetId = item.Citizen_ID || item.Request_ID || item.Interview_ID || item.Letter_ID || item.id || item.Org_ID;
  if (!targetId) return;

  var lastRow = sheet.getLastRow();
  var foundRow = -1;

  if (lastRow > 1) {
    var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(targetId)) {
        foundRow = i + 2;
        break;
      }
    }
  }

  var rowValues = convertItemToRow(table, item);

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function handleDelete(sheet, table, id) {
  if (!id) return;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      break;
    }
  }
}

function convertItemToRow(table, item) {
  switch(table) {
    case 'citizens':
      return [
        item.Citizen_ID || '',
        item.FullName || '',
        item.Phone1 || '',
        item.Phone2 || '',
        item.District || '',
        item.SubDistrict || '',
        item.Gender || '',
        item.Rating || '',
        item.Job || '',
        item.Education || '',
        item.ReferralSource || '',
        item.CreatedAt || '',
        item.PhotoUrl || ''
      ];
    case 'requests':
      return [
        item.Request_ID || '',
        item.Citizen_ID || '',
        item.CitizenName || '',
        item.Phone1 || '',
        item.Entity || '',
        item.RequestStatus || '',
        item.ProcessingStatus || '',
        item.Priority || '',
        item.Details || '',
        item.CreatedAt || '',
        item.CreatedBy || ''
      ];
    case 'interviews':
      return [
        item.Interview_ID || '',
        item.Citizen_ID || '',
        item.CitizenName || '',
        item.Date || '',
        item.Status || '',
        item.CreatedAt || ''
      ];
    case 'letters':
      return [
        item.Letter_ID || '',
        item.Letter_Number || '',
        item.Letter_Date || '',
        item.To_Entity || '',
        item.Subject || '',
        item.Recipient || '',
        item.Status || '',
        item.ClerkName || ''
      ];
    case 'cheques':
      return [
        item.id || '',
        item.ChequeNumber || '',
        item.Citizen_ID || '',
        item.CitizenName || '',
        item.Amount || 0,
        item.BankName || '',
        item.Purpose || '',
        item.Status || '',
        item.IssueDate || '',
        item.DueDate || ''
      ];
    case 'custom_sections':
      return [
        item.id || '',
        item.title || '',
        item.description || '',
        item.icon || '',
        item.badgeColor || '',
        JSON.stringify(item.fields || []),
        item.createdAt || ''
      ];
    case 'custom_records':
      return [
        item.id || '',
        item.sectionId || '',
        JSON.stringify(item.data || {}),
        item.createdAt || '',
        item.createdBy || ''
      ];
    default:
      return [
        item.id || item.Citizen_ID || item.Request_ID || '',
        JSON.stringify(item)
      ];
  }
}

function handleBulkSync(ss, allData) {
  if (allData.citizens) {
    var cSheet = ss.getSheetByName('سجل_المراجعين_Citizens');
    if (cSheet && cSheet.getLastRow() > 1) {
      cSheet.getRange(2, 1, cSheet.getLastRow() - 1, cSheet.getLastColumn()).clearContent();
    }
    allData.citizens.forEach(function(c) { handleUpsert(cSheet, 'citizens', c); });
  }
  if (allData.requests) {
    var rSheet = ss.getSheetByName('طلبات_المواطنين_Requests');
    if (rSheet && rSheet.getLastRow() > 1) {
      rSheet.getRange(2, 1, rSheet.getLastRow() - 1, rSheet.getLastColumn()).clearContent();
    }
    allData.requests.forEach(function(r) { handleUpsert(rSheet, 'requests', r); });
  }
}
`;

export const APPS_SCRIPT_PRODUCTION_CODE = GOOGLE_APPS_SCRIPT_SOURCE;

export const APPS_SCRIPT_SETUP_GUIDE = [
  'افتح جدول Google Sheets المخصص لبيانات مكتب النائب',
  'من القائمة اختر Extensions (ملحقات) ثم Apps Script',
  'الصق الكود البرمجي في Code.gs ثم احفظ',
  'اضغط Deploy ثم New deployment واختر Web app',
  'اختر Anyone في Who has access وانسخ الرابط'
];
