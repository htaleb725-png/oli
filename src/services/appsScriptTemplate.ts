/**
 * Google Apps Script Production Engine (محرك مزامنة Google Sheets و Google Drive الرسمي)
 * -----------------------------------------------------------------------------------
 * هذا الكود الجاهز يقوم المستخدم بنسخه ولصقه في Google Sheets:
 * الإضافات (Extensions) -> Apps Script -> لصق الكود -> نشر (Deploy) -> تطبيق ويب (Web App)
 * الصلاحية: Anyone (أي شخص لديه الرابط)
 */

export const GOOGLE_APPS_SCRIPT_SOURCE = `/**
 * =========================================================================
 * منظومة مكتب النائب المهندسة علا عودة الناشي - الإصدار السحابي المركزي 2026
 * محرك المزامنة التلقائي الذكي المزدوج (Dual-Sync Dynamic Engine)
 * يدعم الاكتشاف التلقائي للأقسام والحقول الجديدة وإنشاء الأوراق والأعمدة فورياً
 * =========================================================================
 */

// تهيئة وإنشاء الجداول الأساسية
function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var coreTabs = [
    { 
      name: 'سجل_المراجعين_Citizens', 
      headers: ['Citizen_ID', 'FullName', 'Phone1', 'Phone2', 'District', 'SubDistrict', 'Gender', 'Rating', 'Job', 'Education', 'ReferralSource', 'CreatedAt', 'PhotoUrl', 'UpdatedAt'] 
    },
    { 
      name: 'طلبات_المواطنين_Requests', 
      headers: ['Request_ID', 'Citizen_ID', 'CitizenName', 'CitizenPhone', 'Entity', 'Details', 'OutgoingNumber', 'OutgoingDate', 'Address', 'ReferralSource', 'Margin', 'ProcessingStatus', 'DeliveryStatus', 'Education', 'Job', 'TargetDepartment', 'CreatedAt', 'CreatedBy', 'OtherNotes', 'UpdatedAt'] 
    },
    { 
      name: 'مقابلات_النائب_Interviews', 
      headers: ['Interview_ID', 'Citizen_ID', 'CitizenName', 'InterviewDate', 'Status', 'CreatedAt', 'UpdatedAt'] 
    },
    { 
      name: 'الكتب_الرسمية_Letters', 
      headers: ['Letter_ID', 'Letter_Number', 'Letter_Date', 'To_Entity', 'Subject', 'Recipient', 'Status', 'ClerkName', 'UpdatedAt'] 
    },
    { 
      name: 'صكوك_المساعدات_Cheques', 
      headers: ['id', 'ChequeNumber', 'Citizen_ID', 'CitizenName', 'Amount', 'BankName', 'Purpose', 'Status', 'IssueDate', 'DueDate', 'UpdatedAt'] 
    },
    { 
      name: 'السجل_التنظيمي_Org', 
      headers: ['Org_ID', 'Citizen_ID', 'FullName', 'OrgRating', 'UpdatedAt'] 
    },
    { 
      name: 'الأقسام_المخصصة_Sections', 
      headers: ['id', 'title', 'description', 'icon', 'badgeColor', 'fieldsJson', 'createdAt', 'updatedAt'] 
    },
    { 
      name: 'سجلات_الأقسام_Records', 
      headers: ['id', 'sectionId', 'dataJson', 'createdAt', 'createdBy', 'updatedAt'] 
    },
    { 
      name: 'إعدادات_القوائم_Dropdowns', 
      headers: ['Category', 'Value', 'UpdatedAt'] 
    }
  ];

  coreTabs.forEach(function(t) {
    var sheet = ss.getSheetByName(t.name);
    if (!sheet) {
      sheet = ss.insertSheet(t.name);
    }
    ensureSheetHeaders(sheet, t.headers);
  });

  return { status: 'success', message: 'تم تجهيز وتنسيق كافة الجداول بنجاح' };
}

/**
 * دالة ذكية لفحص وتوسيع رؤوس الأعمدة تلقائياً دون لمس البيانات القديمة
 */
function ensureSheetHeaders(sheet, requiredHeaders) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow === 0 || lastCol === 0) {
    // الورقة فارغة بالكامل، ننشئ سطر الرؤوس
    sheet.appendRow(requiredHeaders);
    var range = sheet.getRange(1, 1, 1, requiredHeaders.length);
    range.setBackground('#0f172a');
    range.setFontColor('#fbbf24');
    range.setFontWeight('bold');
    sheet.setFrozenRows(1);
    return requiredHeaders;
  }

  // قراءة الأعمدة الحالية
  var existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h).trim();
  });

  var newHeadersToAdd = [];
  requiredHeaders.forEach(function(h) {
    var cleanH = String(h).trim();
    if (cleanH && existingHeaders.indexOf(cleanH) === -1) {
      newHeadersToAdd.push(cleanH);
    }
  });

  // إضافة أي عمود جديد إلى اليمين وتنسيقه فورياً
  if (newHeadersToAdd.length > 0) {
    var startCol = lastCol + 1;
    var addRange = sheet.getRange(1, startCol, 1, newHeadersToAdd.length);
    addRange.setValues([newHeadersToAdd]);
    addRange.setBackground('#0f172a');
    addRange.setFontColor('#fbbf24');
    addRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    return existingHeaders.concat(newHeadersToAdd);
  }

  return existingHeaders;
}

/**
 * تحديد اسم الورقة المناسب للقسم (يدعم الأقسام الأساسية وأي قسم جديد يضاف في الكود مستقبلاً)
 */
function resolveSheetName(table) {
  var clean = String(table || '').trim();
  switch (clean) {
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
    default:
      // إذا كان اسماً عربياً أو قسماً جديداً مضافاً بالكود
      if (clean.indexOf(' ') > -1) {
        return clean.replace(/\\s+/g, '_');
      }
      return clean || 'سجل_المراجعين_Citizens';
  }
}

/**
 * دالة GET: جلب البيانات وقراءة المنظومة
 */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getAllData';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. جلب كافة الجداول بطلب واحد
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

    // استعراض والبحث المباشر في مجلد Google Drive عبر GET (سريع ومتوافق مع Vercel)
    if (action === 'listDriveFiles' || action === 'searchDriveFiles') {
      var targetFolderId = (e && e.parameter && e.parameter.folderId) ? e.parameter.folderId : '';
      var qText = (e && e.parameter && (e.parameter.query || e.parameter.q)) ? (e.parameter.query || e.parameter.q) : '';
      var driveFiles = handleDriveList(targetFolderId, qText);
      return jsonResponse({
        success: true,
        folderId: targetFolderId,
        totalInFolder: driveFiles.length,
        files: driveFiles
      });
    }

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
 * دالة POST: استقبال وحفظ ومزامنة وتوسيع البيانات والأقسام تلقائياً
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

    // 1. مزامنة الهيكل والأقسام الجديدة تلقائياً (Schema Auto-Sync)
    if (action === 'syncSchema' || action === 'registerSection') {
      var sections = contents.sections || [];
      if (data && data.title) sections.push(data);
      
      sections.forEach(function(sec) {
        var sheetName = resolveSheetName(sec.title || sec.name || sec.id);
        var s = ss.getSheetByName(sheetName);
        if (!s) s = ss.insertSheet(sheetName);
        
        var fieldHeaders = ['id'];
        if (sec.fields && Array.isArray(sec.fields)) {
          sec.fields.forEach(function(f) {
            var fName = f.name || f.key || f.label;
            if (fName && fieldHeaders.indexOf(fName) === -1) fieldHeaders.push(fName);
          });
        }
        fieldHeaders.push('createdAt', 'updatedAt');
        ensureSheetHeaders(s, fieldHeaders);
      });

      return jsonResponse({
        success: true,
        message: 'تم فحص ومزامنة وتوسيع هيكل الأقسام والأعمدة بنجاح',
        timestamp: new Date().toISOString()
      });
    }

    // 2. مزامنة شاملة لكافة الجداول (Bulk / Full Sync)
    if (action === 'bulk_sync' || action === 'syncAll') {
      handleBulkSync(ss, data);
      return jsonResponse({
        success: true,
        message: 'تم بنجاح حفظ وتحديث كافة بيانات المنظومة في Google Sheets',
        timestamp: new Date().toISOString()
      });
    }

    // 3. رفع ملف أو صورة إلى Google Drive
    if (action === 'uploadFile') {
      var fileRes = handleDriveUpload(contents);
      return jsonResponse(fileRes);
    }

    // 3.1 استعراض والبحث في ملفات وصور Google Drive المباشرة
    if (action === 'listDriveFiles') {
      var targetFolderId = contents.folderId || '1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc';
      var searchQuery = contents.query || '';
      var listRes = handleDriveList(targetFolderId, searchQuery);
      return jsonResponse({
        success: true,
        files: listRes
      });
    }

    // 3.2 حذف ملف من مجلد Google Drive
    if (action === 'deleteDriveFile') {
      var delRes = handleDriveDelete(contents.fileId);
      return jsonResponse(delRes);
    }

    // 4. العمليات الفردية (إضافة / تعديل / حذف)
    var targetSheetName = resolveSheetName(table);
    var sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) {
      sheet = ss.insertSheet(targetSheetName);
    }

    var targetId = contents.id || data.id || data.Citizen_ID || data.Request_ID || data.Interview_ID || data.Letter_ID || data.Cheque_ID || data.Org_ID;

    if (action === 'delete') {
      handleDelete(sheet, targetId);
    } else {
      handleDynamicUpsert(sheet, data, targetId);
    }

    return jsonResponse({
      success: true,
      message: 'تم تحديث السجل وتوسيع الأعمدة بنجاح في Google Sheets',
      sheet: targetSheetName,
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

/**
 * دالة الإدخال والتحديث الذكية مع الاكتشاف التلقائي للأعمدة الجديدة
 */
function handleDynamicUpsert(sheet, item, targetId) {
  if (!item || typeof item !== 'object') return;

  // 1. استخراج كل المفاتيح القادمة من الكود/الواجهة
  var itemKeys = Object.keys(item);
  var preferredFirstCol = item.Citizen_ID ? 'Citizen_ID' : item.Request_ID ? 'Request_ID' : item.Interview_ID ? 'Interview_ID' : item.Letter_ID ? 'Letter_ID' : 'id';
  
  var desiredHeaders = [preferredFirstCol];
  itemKeys.forEach(function(k) {
    if (k !== preferredFirstCol && desiredHeaders.indexOf(k) === -1) {
      desiredHeaders.push(k);
    }
  });

  // 2. تحديث وتوسيع رؤوس الأعمدة دون المساس برؤوس أخرى
  var headers = ensureSheetHeaders(sheet, desiredHeaders);

  // 3. البحث عن الصف إن كان موجوداً مسبقاً للتعديل عليه
  var idToMatch = String(targetId || item[preferredFirstCol] || item.id || '').trim();
  var foundRow = -1;
  var lastRow = sheet.getLastRow();

  if (idToMatch && lastRow > 1) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === idToMatch) {
        foundRow = i + 2;
        break;
      }
    }
  }

  // 4. بناء قيم الصف بما يطابق تماماً ترتيب الأعمدة الحالي
  var existingRowVals = [];
  if (foundRow > 0) {
    existingRowVals = sheet.getRange(foundRow, 1, 1, headers.length).getValues()[0];
  }

  var rowVals = headers.map(function(h, colIdx) {
    if (item[h] !== undefined && item[h] !== null) {
      var val = item[h];
      if (typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val;
    }
    // الحفاظ على القيمة القديمة إن لم يتم إرسال قيمة جديدة
    return (existingRowVals[colIdx] !== undefined) ? existingRowVals[colIdx] : '';
  });

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowVals.length).setValues([rowVals]);
  } else {
    sheet.appendRow(rowVals);
  }
}

function handleDelete(sheet, id) {
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
    if (item.FullName && !item.CitizenName) item.CitizenName = item.FullName;
    if (item.Phone1 && !item.CitizenPhone) item.CitizenPhone = item.Phone1;
    records.push(item);
  }
  return records;
}

function handleBulkSync(ss, allData) {
  if (!allData || typeof allData !== 'object') return;

  var mapping = [
    { key: 'citizens', name: 'سجل_المراجعين_Citizens' },
    { key: 'requests', name: 'طلبات_المواطنين_Requests' },
    { key: 'interviews', name: 'مقابلات_النائب_Interviews' },
    { key: 'officialLetters', name: 'الكتب_الرسمية_Letters' },
    { key: 'cheques', name: 'صكوك_المساعدات_Cheques' },
    { key: 'organizationRecords', name: 'السجل_التنظيمي_Org' },
    { key: 'customSections', name: 'الأقسام_المخصصة_Sections' },
    { key: 'customRecords', name: 'سجلات_الأقسام_Records' }
  ];

  mapping.forEach(function(m) {
    var items = allData[m.key];
    if (Array.isArray(items) && items.length > 0) {
      var sheet = ss.getSheetByName(m.name);
      if (!sheet) sheet = ss.insertSheet(m.name);
      items.forEach(function(it) {
        handleDynamicUpsert(sheet, it, it.id || it.Citizen_ID || it.Request_ID || it.Interview_ID || it.Letter_ID);
      });
    }
  });
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

function normalizeArabicForDrive(str) {
  return String(str || '')
    .replace(/[\\u064B-\\u065F\\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, function(d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
    .replace(/\\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function handleDriveList(folderId, query) {
  var results = [];
  try {
    var folder;
    if (folderId) {
      var cleanFolderId = String(folderId).trim();
      var m = cleanFolderId.match(/folders\\/([a-zA-Z0-9_-]+)/);
      if (m && m[1]) cleanFolderId = m[1];
      try { folder = DriveApp.getFolderById(cleanFolderId); } catch(e) { folder = DriveApp.getRootFolder(); }
    } else {
      folder = DriveApp.getRootFolder();
    }
    var normQ = normalizeArabicForDrive(query || '');
    var qTokens = normQ ? normQ.split(' ').filter(function(t) { return t.length > 0; }) : [];
    var files = folder.getFiles();
    var count = 0;
    while (files.hasNext() && count < 250) {
      var f = files.next();
      if (f.isTrashed()) continue;
      var name = f.getName();
      var mime = f.getMimeType();
      var normName = normalizeArabicForDrive(name);
      var matched = true;
      if (qTokens.length > 0) {
        for (var i = 0; i < qTokens.length; i++) {
          if (normName.indexOf(qTokens[i]) === -1) {
            matched = false;
            break;
          }
        }
      }
      if (matched) {
        var fid = f.getId();
        results.push({
          id: fid,
          name: name,
          mimeType: mime,
          size: String(f.getSize()),
          thumbnailLink: 'https://drive.google.com/thumbnail?id=' + fid + '&sz=w1200',
          webViewLink: 'https://drive.google.com/file/d/' + fid + '/view',
          webContentLink: 'https://drive.google.com/uc?export=download&id=' + fid,
          url: 'https://drive.google.com/thumbnail?id=' + fid + '&sz=w1600',
          viewUrl: f.getUrl(),
          createdTime: f.getDateCreated().toISOString(),
          modifiedTime: f.getLastUpdated().toISOString()
        });
        count++;
      }
    }
    results.sort(function(a, b) {
      return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
    });
  } catch (err) {}
  return results;
}

function handleDriveDelete(fileId) {
  try {
    if (!fileId) return { success: false, error: 'معرف الملف غير محدد' };
    var f = DriveApp.getFileById(fileId);
    f.setTrashed(true);
    return { success: true, message: 'تم نقل الملف إلى سلة محذوفات Google Drive' };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
`;

export const APPS_SCRIPT_PRODUCTION_CODE = GOOGLE_APPS_SCRIPT_SOURCE;

export const APPS_SCRIPT_SETUP_GUIDE = [
  'افتح ملف Google Sheets المخصص لمنظومة مكتب النائب',
  'من القائمة العلوية اضغط على Extensions (الإضافات) ثم اختر Apps Script',
  'احذف أي كود موجود في نافذة Code.gs والصق هذا الكود الكامل بالكامل ثم احفظ (Ctrl + S)',
  'اضغط على زر Deploy (نشر) بالأعلى واختر New deployment (نشر جديد)',
  'اضغط على ترس الإعدادات واختر Web app (تطبيق ويب)، واجعل Execute as: Me (حسابي)، و Who has access: Anyone (أي شخص)',
  'اضغط Deploy وامنح الأذونات، ثم انسخ رابط الويب الممنوح وضعه في متغير VITE_GOOGLE_APPS_SCRIPT_URL في Vercel أو في إعدادات المنظومة!'
];
