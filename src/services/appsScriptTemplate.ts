/**
 * Google Apps Script Production Engine (محرك مزامنة Google Sheets و Google Drive الرسمي)
 * -----------------------------------------------------------------------------------
 * هذا الكود الجاهز يقوم المطور بنسخه ولصقه في Google Sheets:
 * الإضافات (Extensions) -> Apps Script -> لصق الكود -> نشر (Deploy) -> تطبيق ويب (Web App)
 * الصلاحية: Anyone (أي شخص لديه الرابط)
 */

export const GOOGLE_APPS_SCRIPT_SOURCE = `/**
 * =========================================================================
 * منظومة مكتب النائب المهندسة علا عودة الناشي - الإصدار السحابي المركزي 2026
 * محرك المزامنة الحية مع Google Sheets و Google Drive (إرسال وجلب البيانات)
 * =========================================================================
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
    { name: 'سجلات_الأقسام_Records', headers: ['id', 'sectionId', 'dataJson', 'createdAt', 'createdBy'] },
    { name: 'إعدادات_القوائم_Dropdowns', headers: ['Category', 'Value', 'UpdatedAt'] }
  ];

  tabs.forEach(function(t) {
    var sheet = ss.getSheetByName(t.name);
    if (!sheet) {
      sheet = ss.insertSheet(t.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(t.headers);
      var headerRange = sheet.getRange(1, 1, 1, t.headers.length);
      headerRange.setBackground('#0f172a');
      headerRange.setFontColor('#fbbf24');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });

  return { status: 'success', message: 'تم تجهيز وتنسيق كافة الجداول بنجاح' };
}

/**
 * دالة GET: قراءة وجلب البيانات من Google Sheets إلى المنظومة
 */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getAllData';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. جلب كافة الجداول بطلب واحد (getAllData)
    if (action === 'getAllData') {
      var citizens = getSheetRecords(ss, 'سجل_المراجعين_Citizens');
      var requests = getSheetRecords(ss, 'طلبات_المواطنين_Requests');
      var interviews = getSheetRecords(ss, 'مقابلات_النائب_Interviews');
      var officialLetters = getSheetRecords(ss, 'الكتب_الرسمية_Letters');
      var cheques = getSheetRecords(ss, 'صكوك_المساعدات_Cheques');
      var organizationRecords = getSheetRecords(ss, 'السجل_التنظيمي_Org');
      var customSections = getSheetRecords(ss, 'الأقسام_المخصصة_Sections');
      var customRecords = getSheetRecords(ss, 'سجلات_الأقسام_Records');

      return jsonResponse({
        success: true,
        message: 'تم جلب كافة البيانات بنجاح من Google Sheets',
        data: {
          citizens: citizens,
          requests: requests,
          interviews: interviews,
          officialLetters: officialLetters,
          cheques: cheques,
          organizationRecords: organizationRecords,
          customSections: customSections,
          customRecords: customRecords
        },
        // Direct root fields for maximum compatibility
        citizens: citizens,
        requests: requests,
        interviews: interviews,
        officialLetters: officialLetters,
        cheques: cheques,
        organizationRecords: organizationRecords
      });
    }

    if (action === 'getCitizens') return jsonResponse({ success: true, data: getSheetRecords(ss, 'سجل_المراجعين_Citizens') });
    if (action === 'getRequests') return jsonResponse({ success: true, data: getSheetRecords(ss, 'طلبات_المواطنين_Requests') });
    if (action === 'getInterviews') return jsonResponse({ success: true, data: getSheetRecords(ss, 'مقابلات_النائب_Interviews') });

    return jsonResponse({
      status: 'online',
      appName: 'منظومة مكتب النائب علا الناشي',
      spreadsheetName: ss.getName(),
      sheetsCount: ss.getSheets().length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * دالة POST: استقبال وحفظ وإرسال البيانات من المنظومة إلى Google Sheets و Drive
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);
  
  try {
    var contents = {};
    if (e && e.postData && e.postData.contents) {
      try {
        contents = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        contents = {};
      }
    }

    var action = contents.action || 'appendRow';
    var table = contents.table || contents.sheetType || 'citizens';
    var data = contents.data || contents.record || {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    setupSpreadsheet();

    // 1. مزامنة شاملة (Bulk / Full Sync)
    if (action === 'bulk_sync' || action === 'syncAll') {
      handleBulkSync(ss, data);
      return jsonResponse({
        success: true,
        message: 'تم بنجاح حفظ وتحديث كافة بيانات المنظومة في Google Sheets',
        timestamp: new Date().toISOString()
      });
    }

    // 2. رفع ملف إلى Google Drive
    if (action === 'uploadFile') {
      var fileRes = handleDriveUpload(contents);
      return jsonResponse(fileRes);
    }

    // 3. إدخال أو تحديث صف فردي (insert, update, appendRow, updateRow, upsert)
    var targetSheetName = getSheetNameForTable(table);
    var sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) {
      sheet = ss.insertSheet(targetSheetName);
    }

    if (action === 'delete') {
      handleDelete(sheet, table, data.id || data.Citizen_ID || data.Request_ID);
    } else {
      handleUpsert(sheet, table, data);
    }

    return jsonResponse({
      success: true,
      message: 'تم تحديث السجل بنجاح في Google Sheets',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

function getSheetNameForTable(table) {
  switch (table) {
    case 'citizens': return 'سجل_المراجعين_Citizens';
    case 'requests': return 'طلبات_المواطنين_Requests';
    case 'interviews': return 'مقابلات_النائب_Interviews';
    case 'letters': 
    case 'officialLetters': return 'الكتب_الرسمية_Letters';
    case 'cheques': return 'صكوك_المساعدات_Cheques';
    case 'organization': 
    case 'organizations': return 'السجل_التنظيمي_Org';
    case 'custom_sections': return 'الأقسام_المخصصة_Sections';
    case 'custom_records': return 'سجلات_الأقسام_Records';
    case 'dropdowns': return 'إعدادات_القوائم_Dropdowns';
    default: return 'سجل_المراجعين_Citizens';
  }
}

function getSheetRecords(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) return [];

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var records = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row || !row[0]) continue;
    var item = {};
    for (var j = 0; j < headers.length; j++) {
      var h = headers[j];
      item[h] = row[j] !== undefined ? row[j] : '';
    }
    // Normalize aliases
    if (item.FullName && !item.CitizenName) item.CitizenName = item.FullName;
    if (item.Phone1 && !item.CitizenPhone) item.CitizenPhone = item.Phone1;
    records.push(item);
  }
  return records;
}

function handleUpsert(sheet, table, item) {
  var idCol = 1;
  var targetId = item.Citizen_ID || item.Request_ID || item.Interview_ID || item.Letter_ID || item.id || item.Org_ID;
  if (!targetId) {
    // If no ID, append directly
    var rowValues = convertItemToRow(table, item);
    sheet.appendRow(rowValues);
    return;
  }

  var lastRow = sheet.getLastRow();
  var foundRow = -1;

  if (lastRow > 1) {
    var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(targetId).trim()) {
        foundRow = i + 2;
        break;
      }
    }
  }

  var rowVals = convertItemToRow(table, item);

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowVals.length).setValues([rowVals]);
  } else {
    sheet.appendRow(rowVals);
  }
}

function handleDelete(sheet, table, id) {
  if (!id) return;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) {
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
        item.FullName || item.CitizenName || '',
        item.Phone1 || item.CitizenPhone || '',
        item.Phone2 || '',
        item.District || '',
        item.SubDistrict || '',
        item.Gender || 'ذكر',
        item.Rating || 'لائق',
        item.Job || '',
        item.Education || '',
        item.ReferralSource || '',
        item.CreatedAt || new Date().toISOString().split('T')[0],
        item.PhotoUrl || ''
      ];
    case 'requests':
      return [
        item.Request_ID || '',
        item.Citizen_ID || '',
        item.CitizenName || item.FullName || '',
        item.CitizenPhone || item.Phone1 || '',
        item.Entity || '',
        item.RequestStatus || 'مستلم',
        item.ProcessingStatus || 'قيد التدقيق',
        item.Priority || 'عادي',
        item.Details || '',
        item.CreatedAt || new Date().toISOString().split('T')[0],
        item.CreatedBy || 'الإدارة'
      ];
    case 'interviews':
      return [
        item.Interview_ID || '',
        item.Citizen_ID || '',
        item.FullName || item.CitizenName || '',
        item.InterviewDate || item.Date || '',
        item.Status || 'مكتملة',
        item.CreatedAt || new Date().toISOString().split('T')[0]
      ];
    case 'letters':
    case 'officialLetters':
      return [
        item.Letter_ID || '',
        item.Letter_Number || item.LetterNumber || '',
        item.Letter_Date || item.LetterDate || '',
        item.To_Entity || item.Recipient || '',
        item.Subject || '',
        item.Recipient || '',
        item.Status || 'صادر',
        item.ClerkName || 'الطباعة'
      ];
    case 'cheques':
      return [
        item.id || item.Cheque_ID || '',
        item.ChequeNumber || '',
        item.Citizen_ID || '',
        item.CitizenName || '',
        item.Amount || 0,
        item.BankName || '',
        item.Purpose || '',
        item.Status || 'مصروف',
        item.IssueDate || '',
        item.DueDate || ''
      ];
    case 'organization':
    case 'organizations':
      return [
        item.Citizen_ID || '',
        item.FullName || '',
        item.OrgRating || item.Rating || 'A',
        item.UpdatedAt || new Date().toISOString()
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
        JSON.stringify(item),
        new Date().toISOString()
      ];
  }
}

function handleBulkSync(ss, allData) {
  if (allData.citizens && allData.citizens.length > 0) {
    var cSheet = ss.getSheetByName('سجل_المراجعين_Citizens');
    if (cSheet) {
      if (cSheet.getLastRow() > 1) {
        cSheet.getRange(2, 1, cSheet.getLastRow() - 1, cSheet.getLastColumn()).clearContent();
      }
      allData.citizens.forEach(function(c) { handleUpsert(cSheet, 'citizens', c); });
    }
  }
  if (allData.requests && allData.requests.length > 0) {
    var rSheet = ss.getSheetByName('طلبات_المواطنين_Requests');
    if (rSheet) {
      if (rSheet.getLastRow() > 1) {
        rSheet.getRange(2, 1, rSheet.getLastRow() - 1, rSheet.getLastColumn()).clearContent();
      }
      allData.requests.forEach(function(r) { handleUpsert(rSheet, 'requests', r); });
    }
  }
  if (allData.interviews && allData.interviews.length > 0) {
    var iSheet = ss.getSheetByName('مقابلات_النائب_Interviews');
    if (iSheet) {
      allData.interviews.forEach(function(item) { handleUpsert(iSheet, 'interviews', item); });
    }
  }
  if (allData.officialLetters && allData.officialLetters.length > 0) {
    var lSheet = ss.getSheetByName('الكتب_الرسمية_Letters');
    if (lSheet) {
      allData.officialLetters.forEach(function(item) { handleUpsert(lSheet, 'letters', item); });
    }
  }
  if (allData.cheques && allData.cheques.length > 0) {
    var chSheet = ss.getSheetByName('صكوك_المساعدات_Cheques');
    if (chSheet) {
      allData.cheques.forEach(function(item) { handleUpsert(chSheet, 'cheques', item); });
    }
  }
}

function handleDriveUpload(contents) {
  var folderId = contents.folderId;
  var fileName = contents.fileName || ('document_' + Date.now() + '.jpg');
  var base64Data = contents.fileData || contents.data;

  if (!base64Data) {
    return { success: false, error: 'لم يتم إرسال بيانات الملف' };
  }

  var folder;
  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      folder = DriveApp.getRootFolder();
    }
  } else {
    folder = DriveApp.getRootFolder();
  }

  var cleanBase64 = base64Data;
  var contentType = 'image/jpeg';
  if (base64Data.indexOf('data:') === 0) {
    var parts = base64Data.split(',');
    var match = parts[0].match(/:(.*?);/);
    if (match) contentType = match[1];
    cleanBase64 = parts[1];
  }

  var decodedBytes = Utilities.base64Decode(cleanBase64);
  var blob = Utilities.newBlob(decodedBytes, contentType, fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    fileId: file.getId(),
    webViewLink: file.getUrl(),
    directUrl: 'https://drive.google.com/uc?export=view&id=' + file.getId()
  };
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
`;

export const APPS_SCRIPT_PRODUCTION_CODE = GOOGLE_APPS_SCRIPT_SOURCE;

export const APPS_SCRIPT_SETUP_GUIDE = [
  'افتح جدول Google Sheets المخصص لبيانات مكتب النائب',
  'من القائمة اختر Extensions (ملحقات) ثم Apps Script',
  'احذف أي كود قديم والصق الكود البرمجي الكامل أعلاه في ملف Code.gs ثم احفظ (Ctrl + S)',
  'اضغط زر Deploy (نشر) بالأعلى ثم New deployment (نشر جديد) واختر نوع Web app (تطبيق ويب)',
  'في خانة Execute as اختر Me (حسابي)، وفي Who has access اختر Anyone (أي شخص)',
  'انسخ رابط تطبيق الويب (Web App URL) والصقه في المنظومة لتعمل المزامنة والجلب والإرسال فورياً بدون أي توقف!'
];
