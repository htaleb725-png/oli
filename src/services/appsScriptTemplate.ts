/**
 * Google Apps Script Production Engine (محرك مزامنة Google Sheets و Google Drive الرسمي)
 * -----------------------------------------------------------------------------------
 * هذا الكود الجاهز يقوم المستخدم بنسخه ولصقه في Google Sheets:
 * الإضافات (Extensions) -> Apps Script -> لصق الكود -> نشر (Deploy) -> تطبيق ويب (Web App)
 * الصلاحية: Anyone (أي شخص لديه الرابط)
 */

export const GOOGLE_APPS_SCRIPT_SOURCE = `/**
 * =========================================================================
 * منظومة مكتب النائب المهندسة علا عودة الناشي - الإصدار السحابي المنظم 2026
 * محرك المزامنة الموحد بأعمدة عربية معزولة ومنظمة 100% (بدون تداخل أو حقول JSON)
 * يدعم التسجيل المباشر + رفع وتصفية ملفات الإكسل + البحث المباشر في Google Drive
 * =========================================================================
 */

// الجداول الأساسية بأعمدتها العربية المعزولة والثابتة (كل معلومة في عمود مستقل تماماً)
var CORE_SCHEMAS = {
  'سجل_المراجعين_Citizens': {
    idKey: 'Citizen_ID',
    columns: [
      { header: 'الرقم التعريفي', key: 'Citizen_ID', aliases: ['Citizen_ID', 'id', 'الرقم التعريفي'] },
      { header: 'الاسم الكامل', key: 'FullName', aliases: ['FullName', 'CitizenName', 'الاسم الكامل', 'الاسم الكامل الرباعي', 'اسم المواطن'] },
      { header: 'الاسم الأول', key: 'FirstName', aliases: ['FirstName', 'الاسم الأول'] },
      { header: 'اسم الأب', key: 'FatherName', aliases: ['FatherName', 'اسم الأب'] },
      { header: 'اسم الجد', key: 'GrandFatherName', aliases: ['GrandFatherName', 'اسم الجد'] },
      { header: 'اللقب / العشيرة', key: 'Surname', aliases: ['Surname', 'اللقب / العشيرة', 'اللقب'] },
      { header: 'رقم الهاتف', key: 'Phone1', aliases: ['Phone1', 'Phone', 'رقم الهاتف', 'الهاتف الرئيسي'] },
      { header: 'الهاتف البديل', key: 'Phone2', aliases: ['Phone2', 'الهاتف البديل', 'الهاتف الثانوي'] },
      { header: 'القضاء', key: 'District', aliases: ['District', 'القضاء'] },
      { header: 'الناحية / المنطقة', key: 'SubDistrict', aliases: ['SubDistrict', 'ResidentialArea', 'الناحية / المنطقة', 'الناحية / الحي'] },
      { header: 'الجنس', key: 'Gender', aliases: ['Gender', 'الجنس'] },
      { header: 'المهنة / العمل', key: 'Job', aliases: ['Job', 'المهنة / العمل', 'المهنة'] },
      { header: 'التحصيل الدراسي', key: 'Education', aliases: ['Education', 'التحصيل الدراسي'] },
      { header: 'التقييم', key: 'Rating', aliases: ['Rating', 'التقييم', 'التقييم الجماهيري'] },
      { header: 'المعرف / التزكية', key: 'ReferralSource', aliases: ['ReferralSource', 'المعرف / التزكية', 'جهة التزكية / المعرف'] },
      { header: 'مصدر التسجيل', key: 'RegisteredVia', aliases: ['RegisteredVia', 'مصدر التسجيل'] },
      { header: 'تاريخ التسجيل', key: 'CreatedAt', aliases: ['CreatedAt', 'تاريخ التسجيل'] },
      { header: 'الموظف المسؤول', key: 'CreatedBy', aliases: ['CreatedBy', 'الموظف المسؤول', 'مسؤول الإدخال'] }
    ]
  },
  'طلبات_المواطنين_Requests': {
    idKey: 'Request_ID',
    columns: [
      { header: 'رقم الطلب', key: 'Request_ID', aliases: ['Request_ID', 'id', 'رقم الطلب'] },
      { header: 'الرقم التعريفي للمواطن', key: 'Citizen_ID', aliases: ['Citizen_ID', 'الرقم التعريفي للمواطن'] },
      { header: 'اسم صاحب الطلب', key: 'CitizenName', aliases: ['CitizenName', 'FullName', 'اسم صاحب الطلب', 'اسم المواطن'] },
      { header: 'رقم الهاتف', key: 'CitizenPhone', aliases: ['CitizenPhone', 'Phone1', 'رقم الهاتف'] },
      { header: 'الوزارة / الجهة', key: 'Entity', aliases: ['Entity', 'الوزارة / الجهة', 'الجهة المعنية'] },
      { header: 'الموضوع / تفاصيل الطلب', key: 'Details', aliases: ['Details', 'الموضوع / تفاصيل الطلب', 'تفاصيل الطلب', 'الموضوع'] },
      { header: 'العدد / الصادر', key: 'OutgoingNumber', aliases: ['OutgoingNumber', 'العدد / الصادر', 'رقم الصادر'] },
      { header: 'تاريخ الصادر', key: 'OutgoingDate', aliases: ['OutgoingDate', 'تاريخ الصادر', 'تاريخ الكتاب'] },
      { header: 'حالة الإنجاز', key: 'ProcessingStatus', aliases: ['ProcessingStatus', 'حالة الإنجاز', 'المرحلة الإجرائية', 'حالة الطلب'] },
      { header: 'حالة الاستلام', key: 'DeliveryStatus', aliases: ['DeliveryStatus', 'RequestStatus', 'حالة الاستلام', 'حالة المعاملة'] },
      { header: 'الأسبقية', key: 'Priority', aliases: ['Priority', 'الأسبقية', 'درجة الأسبقية'] },
      { header: 'العنوان / السكن', key: 'Address', aliases: ['Address', 'ResidentialArea', 'العنوان / السكن', 'العنوان'] },
      { header: 'التحصيل الدراسي', key: 'Education', aliases: ['Education', 'التحصيل الدراسي'] },
      { header: 'المهنة', key: 'Job', aliases: ['Job', 'المهنة'] },
      { header: 'المعرف / التزكية', key: 'ReferralSource', aliases: ['ReferralSource', 'المعرف / التزكية'] },
      { header: 'الهامش / التوجيه', key: 'Margin', aliases: ['Margin', 'DeputyNotes', 'DirectorNotes', 'الهامش / التوجيه', 'توجيهات وملاحظات النائب'] },
      { header: 'القسم المختص', key: 'TargetDepartment', aliases: ['TargetDepartment', 'RegisteredVia', 'القسم المختص'] },
      { header: 'الملاحظات', key: 'OtherNotes', aliases: ['OtherNotes', 'ReceptionNotes', 'الملاحظات'] },
      { header: 'تاريخ التسجيل', key: 'CreatedAt', aliases: ['CreatedAt', 'تاريخ التسجيل', 'تاريخ المعاملة'] },
      { header: 'الموظف المسؤول', key: 'CreatedBy', aliases: ['CreatedBy', 'الموظف المسؤول'] }
    ]
  },
  'مقابلات_النائب_Interviews': {
    idKey: 'Interview_ID',
    columns: [
      { header: 'رمز المقابلة', key: 'Interview_ID', aliases: ['Interview_ID', 'id', 'رمز المقابلة'] },
      { header: 'الرقم التعريفي', key: 'Citizen_ID', aliases: ['Citizen_ID', 'الرقم التعريفي'] },
      { header: 'اسم المواطن', key: 'FullName', aliases: ['FullName', 'CitizenName', 'اسم المواطن'] },
      { header: 'موضوع المقابلة', key: 'Subject', aliases: ['Subject', 'موضوع المقابلة'] },
      { header: 'رقم الهاتف', key: 'Phone1', aliases: ['Phone1', 'رقم الهاتف', 'الهاتف 1'] },
      { header: 'العنوان / السكن', key: 'Address', aliases: ['Address', 'العنوان / السكن', 'السكن / العنوان'] },
      { header: 'تاريخ المقابلة', key: 'InterviewDate', aliases: ['InterviewDate', 'تاريخ المقابلة'] },
      { header: 'حالة المقابلة', key: 'Status', aliases: ['Status', 'حالة المقابلة'] },
      { header: 'توجيه النائب', key: 'DeputyNotes', aliases: ['DeputyNotes', 'توجيه النائب'] },
      { header: 'النتيجة', key: 'Outcome', aliases: ['Outcome', 'النتيجة', 'النتيجة والإجراء المتخذ'] }
    ]
  },
  'الكتب_الرسمية_Letters': {
    idKey: 'Letter_ID',
    columns: [
      { header: 'رمز الكتاب', key: 'Letter_ID', aliases: ['Letter_ID', 'id', 'رمز الكتاب'] },
      { header: 'العدد / الصادر', key: 'LetterNumber', aliases: ['LetterNumber', 'Letter_Number', 'العدد / الصادر', 'العدد / الرقم الإداري'] },
      { header: 'تاريخ الكتاب', key: 'LetterDate', aliases: ['LetterDate', 'Letter_Date', 'تاريخ الكتاب', 'التاريخ'] },
      { header: 'الجهة الموجه إليها', key: 'Recipient', aliases: ['Recipient', 'To_Entity', 'الجهة الموجه إليها'] },
      { header: 'الموضوع', key: 'Subject', aliases: ['Subject', 'الموضوع'] },
      { header: 'اسم المواطن', key: 'CitizenName', aliases: ['CitizenName', 'اسم المواطن'] },
      { header: 'الحالة', key: 'Status', aliases: ['Status', 'الحالة'] },
      { header: 'المنشئ', key: 'ClerkName', aliases: ['ClerkName', 'المنشئ', 'الطباع / المنشئ'] }
    ]
  },
  'صكوك_المساعدات_Cheques': {
    idKey: 'id',
    columns: [
      { header: 'معرف الصك', key: 'id', aliases: ['id', 'معرف القيد', 'معرف الصك'] },
      { header: 'رقم الصك', key: 'ChequeNumber', aliases: ['ChequeNumber', 'رقم الصك'] },
      { header: 'الرقم التعريفي', key: 'Citizen_ID', aliases: ['Citizen_ID', 'الرقم التعريفي'] },
      { header: 'اسم المستفيد', key: 'CitizenName', aliases: ['CitizenName', 'اسم المستفيد'] },
      { header: 'المبلغ', key: 'Amount', aliases: ['Amount', 'المبلغ', 'المبلغ (د.ع)'] },
      { header: 'المصرف', key: 'BankName', aliases: ['BankName', 'المصرف', 'اسم المصرف / الصندوق'] },
      { header: 'الغرض', key: 'Purpose', aliases: ['Purpose', 'الغرض', 'الغرض من الصرف'] },
      { header: 'الحالة', key: 'Status', aliases: ['Status', 'الحالة', 'حالة الصرف'] },
      { header: 'تاريخ التحرير', key: 'IssueDate', aliases: ['IssueDate', 'تاريخ التحرير'] }
    ]
  },
  'السجل_التنظيمي_Org': {
    idKey: 'Citizen_ID',
    columns: [
      { header: 'الرقم التعريفي', key: 'Citizen_ID', aliases: ['Citizen_ID', 'Org_ID', 'الرقم التعريفي'] },
      { header: 'الاسم الكامل', key: 'FullName', aliases: ['FullName', 'الاسم الكامل'] },
      { header: 'القضاء', key: 'District', aliases: ['District', 'القضاء'] },
      { header: 'الناحية', key: 'SubDistrict', aliases: ['SubDistrict', 'الناحية'] },
      { header: 'التقييم التنظيمي', key: 'OrgRating', aliases: ['OrgRating', 'التقييم التنظيمي', 'التقييم الجماهيري'] },
      { header: 'الملاحظات', key: 'Notes', aliases: ['Notes', 'الملاحظات'] },
      { header: 'آخر تحديث', key: 'LastUpdated', aliases: ['LastUpdated', 'UpdatedAt', 'آخر تحديث'] }
    ]
  }
};

// تنظيف كل خلية لضمان عدم تداخل الأسطر أو إدخال كائنات JSON أو صور Base64
function cleanCellVal(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'boolean') return val ? 'نعم' : 'لا';
  if (typeof val === 'object') return '';
  var str = String(val).trim();
  if (!str) return '';
  if (str.indexOf('data:image/') === 0 || str.indexOf('data:application/') === 0) return '';
  if ((str.indexOf('[{') === 0 && str.slice(-2) === '}]') || (str.indexOf('{"') === 0 && str.slice(-1) === '}')) {
    return '';
  }
  return str.replace(/[\\r\\n\\t]+/g, ' ').replace(/\\s{2,}/g, ' ').slice(0, 1500);
}

// تهيئة وتنسيق الجداول الأساسية بأعمدة عربية معزولة ومنظمة (يمين إلى يسار)
function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(CORE_SCHEMAS).forEach(function(sheetName) {
    var schema = CORE_SCHEMAS[sheetName];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    try { sheet.setRightToLeft(true); } catch (e) {}
    var headers = schema.columns.map(function(c) { return c.header; });
    ensureCleanStructuredHeaders(sheet, headers);
  });
  return { status: 'success', message: 'تم تجهيز وتنسيق كافة الجداول بأعمدة معزولة ومنظمة بنجاح' };
}

function ensureCleanStructuredHeaders(sheet, headers) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0f172a');
    headerRange.setFontColor('#fbbf24');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    return headers;
  }
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
}

/**
 * أداة إعادة تنظيم وتنسيق الجداول المختلطة القديمة بضغطة واحدة دون فقدان أي سجل!
 */
function reorganizeAllSheetsCleanly() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(CORE_SCHEMAS).forEach(function(sheetName) {
    var schema = CORE_SCHEMAS[sheetName];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1) return;
    var existing = getSheetRecords(ss, sheetName);
    sheet.clearContents();
    try { sheet.setRightToLeft(true); } catch (e) {}
    var headers = schema.columns.map(function(c) { return c.header; });
    var rows = [headers];
    existing.forEach(function(rec) {
      rows.push(schema.columns.map(function(col) {
        return cleanCellVal(extractFieldBySchemaColumn(rec, col));
      }));
    });
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0f172a');
    headerRange.setFontColor('#fbbf24');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  });
}

function extractFieldBySchemaColumn(item, col) {
  if (item[col.key] !== undefined && item[col.key] !== null && String(item[col.key]).trim() !== '') {
    return item[col.key];
  }
  if (item[col.header] !== undefined && item[col.header] !== null && String(item[col.header]).trim() !== '') {
    return item[col.header];
  }
  for (var i = 0; i < col.aliases.length; i++) {
    var a = col.aliases[i];
    if (item[a] !== undefined && item[a] !== null && String(item[a]).trim() !== '') {
      return item[a];
    }
  }
  return '';
}

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
      if (clean.indexOf(' ') > -1) return clean.replace(/\\s+/g, '_');
      return clean || 'سجل_المراجعين_Citizens';
  }
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getAllData';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

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

    if (action === 'reorganizeSheets') {
      reorganizeAllSheetsCleanly();
      return jsonResponse({ success: true, message: 'تم إعادة ترتيب وتنظيم كافة الأعمدة والبيانات بنجاح' });
    }

    // استعراض والبحث المباشر في مجلد Google Drive عبر GET (حتى 2500 ملف)
    if (action === 'listDriveFiles' || action === 'searchDriveFiles') {
      var targetFolderId = (e && e.parameter && e.parameter.folderId) ? e.parameter.folderId : '';
      var qText = (e && e.parameter && (e.parameter.query || e.parameter.q)) ? (e.parameter.query || e.parameter.q) : '';
      var lim = (e && e.parameter && e.parameter.limit) ? Number(e.parameter.limit) : 2500;
      var driveFiles = handleDriveList(targetFolderId, qText, lim);
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

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    var contents = {};
    if (e && e.postData && e.postData.contents) {
      try { contents = JSON.parse(e.postData.contents); } catch (parseErr) { contents = {}; }
    }

    var action = contents.action || 'appendRow';
    var table = contents.table || contents.sheetType || 'citizens';
    var data = contents.data || contents.record || {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    setupSpreadsheet();

    if (action === 'reorganizeSheets') {
      reorganizeAllSheetsCleanly();
      return jsonResponse({ success: true, message: 'تمت إعادة تنظيم جميع الأعمدة بنجاح' });
    }

    if (action === 'syncSchema' || action === 'registerSection') {
      var sections = contents.sections || [];
      if (data && data.title) sections.push(data);
      sections.forEach(function(sec) {
        var sheetName = resolveSheetName(sec.title || sec.name || sec.id);
        var s = ss.getSheetByName(sheetName);
        if (!s) s = ss.insertSheet(sheetName);
        try { s.setRightToLeft(true); } catch (e) {}
        var fieldHeaders = ['المعرف'];
        if (sec.fields && Array.isArray(sec.fields)) {
          sec.fields.forEach(function(f) {
            var fName = f.label || f.name || f.key;
            if (fName && fieldHeaders.indexOf(fName) === -1) fieldHeaders.push(fName);
          });
        }
        fieldHeaders.push('تاريخ التسجيل', 'الموظف المسؤول');
        ensureCleanStructuredHeaders(s, fieldHeaders);
      });
      return jsonResponse({ success: true, message: 'تمت مزامنة هيكل الأقسام بنجاح' });
    }

    if (action === 'bulk_sync' || action === 'syncAll') {
      handleBulkSync(ss, data);
      return jsonResponse({
        success: true,
        message: 'تم بنجاح حفظ وتحديث كافة البيانات بأعمدة معزولة ومنظمة في Google Sheets',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'uploadFile') {
      return jsonResponse(handleDriveUpload(contents));
    }

    if (action === 'listDriveFiles') {
      var targetFolderId = contents.folderId || '1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc';
      var searchQuery = contents.query || '';
      var reqLimit = Number(contents.limit) || 2500;
      var listRes = handleDriveList(targetFolderId, searchQuery, reqLimit);
      return jsonResponse({ success: true, totalInFolder: listRes.length, files: listRes });
    }

    if (action === 'deleteDriveFile') {
      return jsonResponse(handleDriveDelete(contents.fileId));
    }

    var targetSheetName = resolveSheetName(table);
    var sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) {
      sheet = ss.insertSheet(targetSheetName);
      try { sheet.setRightToLeft(true); } catch (e) {}
    }

    var targetId = contents.id || data.Citizen_ID || data.Request_ID || data.Interview_ID || data.Letter_ID || data.id;

    if (action === 'delete') {
      handleDelete(sheet, targetId);
    } else if (CORE_SCHEMAS[targetSheetName]) {
      handleStructuredUpsertBatch(sheet, CORE_SCHEMAS[targetSheetName], [data]);
    } else {
      handleCustomUpsert(sheet, data, targetId);
    }

    return jsonResponse({
      success: true,
      message: 'تم حفظ السجل في عموده المخصص بنجاح في Google Sheets',
      sheet: targetSheetName,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * إدخال وتحديث منظم (Single + Bulk) للجداول الأساسية بدون إضافة أي أعمدة عشوائية أو JSON!
 * يكتب كل حقل في عموده المخصص بدقة سواء كان الجدول بالعناوين العربية الجديدة أو القديمة.
 */
function handleStructuredUpsertBatch(sheet, schema, items) {
  if (!Array.isArray(items) || items.length === 0) return;

  var standardHeaders = schema.columns.map(function(c) { return c.header; });
  var existingHeaders = ensureCleanStructuredHeaders(sheet, standardHeaders);

  // بناء خريطة تطابق بين رؤوس الأعمدة الموجودة وحقول المخطط الرسمي
  var colToSchema = existingHeaders.map(function(h) {
    for (var cIdx = 0; cIdx < schema.columns.length; cIdx++) {
      var col = schema.columns[cIdx];
      if (h === col.header || h === col.key || col.aliases.indexOf(h) !== -1) {
        return col;
      }
    }
    return null;
  });

  // قراءة المعرفات الموجودة في العمود الأول دفعة واحدة (أسرع بـ 50 مرة من القراءة صفاً بصف!)
  var lastRow = sheet.getLastRow();
  var idRowMap = {};
  if (lastRow > 1) {
    var existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var r = 0; r < existingIds.length; r++) {
      var key = String(existingIds[r][0] || '').trim();
      if (key) idRowMap[key] = r + 2;
    }
  }

  var rowsToAppend = [];

  items.forEach(function(item) {
    if (!item || typeof item !== 'object') return;
    var idCol = schema.columns[0];
    var idVal = cleanCellVal(extractFieldBySchemaColumn(item, idCol));
    if (!idVal) return;

    var rowVals = existingHeaders.map(function(_h, colIdx) {
      var matchedCol = colToSchema[colIdx];
      if (!matchedCol) return '';
      return cleanCellVal(extractFieldBySchemaColumn(item, matchedCol));
    });

    var existingRowNum = idRowMap[idVal];
    if (existingRowNum) {
      var prevRow = sheet.getRange(existingRowNum, 1, 1, existingHeaders.length).getValues()[0];
      var merged = rowVals.map(function(v, idx) {
        return v !== '' ? v : (prevRow[idx] !== undefined ? prevRow[idx] : '');
      });
      sheet.getRange(existingRowNum, 1, 1, merged.length).setValues([merged]);
    } else {
      idRowMap[idVal] = lastRow + rowsToAppend.length + 1;
      rowsToAppend.push(rowVals);
    }
  });

  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, existingHeaders.length).setValues(rowsToAppend);
  }
}

function handleCustomUpsert(sheet, item, targetId) {
  if (!item || typeof item !== 'object') return;
  var flat = {};
  Object.keys(item).forEach(function(k) {
    if (k === 'data' && item.data && typeof item.data === 'object') {
      Object.keys(item.data).forEach(function(dk) {
        flat[dk] = cleanCellVal(item.data[dk]);
      });
    } else {
      var cleaned = cleanCellVal(item[k]);
      if (cleaned !== '' || k === 'id') flat[k] = cleaned;
    }
  });
  var keys = Object.keys(flat);
  if (keys.length === 0) return;
  var headers = ensureCleanStructuredHeaders(sheet, keys);
  var rowVals = headers.map(function(h) { return flat[h] !== undefined ? flat[h] : ''; });
  sheet.appendRow(rowVals);
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
  var headers = values[0].map(function(h) { return String(h || '').trim(); });
  var schema = CORE_SCHEMAS[sheetName];
  var records = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row || !row[0]) continue;
    var item = {};
    for (var j = 0; j < headers.length; j++) {
      var h = headers[j];
      if (!h) continue;
      var cell = row[j] !== undefined && row[j] !== null ? row[j] : '';
      item[h] = cell;
      if (schema) {
        for (var c = 0; c < schema.columns.length; c++) {
          var col = schema.columns[c];
          if (h === col.header || h === col.key || col.aliases.indexOf(h) !== -1) {
            if (item[col.key] === undefined || item[col.key] === '') {
              item[col.key] = cell;
            }
          }
        }
      }
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
    { key: 'organizationRecords', name: 'السجل_التنظيمي_Org' }
  ];
  mapping.forEach(function(m) {
    var items = allData[m.key];
    if (Array.isArray(items) && items.length > 0) {
      var sheet = ss.getSheetByName(m.name);
      if (!sheet) {
        sheet = ss.insertSheet(m.name);
        try { sheet.setRightToLeft(true); } catch (e) {}
      }
      handleStructuredUpsertBatch(sheet, CORE_SCHEMAS[m.name], items);
    }
  });
}

function handleDriveUpload(contents) {
  var folderId = contents.folderId;
  var fileName = contents.fileName || ('document_' + Date.now() + '.jpg');
  var base64Data = contents.fileData || contents.data;
  if (!base64Data) return { success: false, error: 'لم يتم إرسال بيانات الملف' };

  var folder;
  if (folderId) {
    try { folder = DriveApp.getFolderById(folderId); } catch (e) { folder = DriveApp.getRootFolder(); }
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

function handleDriveList(folderId, query, maxLimit) {
  var results = [];
  var limit = Math.min(Math.max(Number(maxLimit) || 2500, 1), 2500);
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
    while (files.hasNext() && count < limit) {
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
  'احذف أي كود موجود في نافذة Code.gs والصق هذا الكود الكامل ثم احفظ (Ctrl + S)',
  'اختياري لترتيب البيانات القديمة المخربطة فوراً: اختر الدالة reorganizeAllSheetsCleanly من الشريط العلوي واضغط Run لترتيب كل عمود وحده بدون حذف أي سجل!',
  'اضغط على زر Deploy (نشر) بالأعلى واختر New deployment (نشر جديد) -> Web app -> Execute as: Me -> Who has access: Anyone',
  'انسخ رابط الويب الجديد واحفظه في إعدادات الربط السحابي بالنظام!'
];
