import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { syncSchemaToGoogleAppsScript } from './realtimeGoogleSync';
import { CustomSection } from '../types';
import { CITIZENS_SHEET_HEADERS, REQUESTS_SHEET_HEADERS } from './googleSheetsSchema';

export interface SectionSchemaDefinition {
  id: string;
  name: string;
  title: string;
  fields: { key: string; label: string; type?: string }[];
  isCustom?: boolean;
}

// 1. Core Built-In Sections Schema Registry
export const CORE_SYSTEM_SECTIONS: SectionSchemaDefinition[] = [
  {
    id: 'citizens',
    name: 'سجل_المراجعين_Citizens',
    title: 'سجل المراجعين والمواطنين',
    fields: CITIZENS_SHEET_HEADERS.map(h => ({ key: h, label: h }))
  },
  {
    id: 'requests',
    name: 'طلبات_المواطنين_Requests',
    title: 'طلبات ومعاملات المواطنين',
    fields: REQUESTS_SHEET_HEADERS.map(h => ({ key: h, label: h }))
  },
  {
    id: 'interviews',
    name: 'مقابلات_النائب_Interviews',
    title: 'مقابلات النائب المباشرة',
    fields: [
      { key: 'Interview_ID', label: 'معرف المقابلة' },
      { key: 'Citizen_ID', label: 'معرف المواطن' },
      { key: 'CitizenName', label: 'اسم المواطن' },
      { key: 'InterviewDate', label: 'تاريخ المقابلة' },
      { key: 'Status', label: 'حالة المقابلة' },
      { key: 'CreatedAt', label: 'تاريخ التسجيل' },
      { key: 'UpdatedAt', label: 'آخر تحديث' }
    ]
  },
  {
    id: 'letters',
    name: 'الكتب_الرسمية_Letters',
    title: 'الكتب والمخاطبات الرسمية',
    fields: [
      { key: 'Letter_ID', label: 'معرف الكتاب' },
      { key: 'Letter_Number', label: 'العدد الصادر' },
      { key: 'Letter_Date', label: 'تاريخ الصادر' },
      { key: 'To_Entity', label: 'الجهة الموجه إليها' },
      { key: 'Subject', label: 'الموضوع' },
      { key: 'Recipient', label: 'المستلم' },
      { key: 'Status', label: 'حالة الكتاب' },
      { key: 'ClerkName', label: 'الموظف المسؤول' },
      { key: 'UpdatedAt', label: 'آخر تحديث' }
    ]
  },
  {
    id: 'cheques',
    name: 'صكوك_المساعدات_Cheques',
    title: 'صكوك المساعدات الإنسانية',
    fields: [
      { key: 'id', label: 'المعرف' },
      { key: 'ChequeNumber', label: 'رقم الصك' },
      { key: 'Citizen_ID', label: 'معرف المواطن' },
      { key: 'CitizenName', label: 'اسم المستفيد' },
      { key: 'Amount', label: 'المبلغ' },
      { key: 'BankName', label: 'المصرف' },
      { key: 'Purpose', label: 'الغرض' },
      { key: 'Status', label: 'الحالة' },
      { key: 'IssueDate', label: 'تاريخ التحرير' },
      { key: 'DueDate', label: 'تاريخ الصرف' },
      { key: 'UpdatedAt', label: 'آخر تحديث' }
    ]
  },
  {
    id: 'organization',
    name: 'السجل_التنظيمي_Org',
    title: 'السجل التنظيمي والمكتبي',
    fields: [
      { key: 'Org_ID', label: 'المعرف' },
      { key: 'Citizen_ID', label: 'معرف المواطن' },
      { key: 'FullName', label: 'الاسم' },
      { key: 'OrgRating', label: 'التقييم التنظيمي' },
      { key: 'UpdatedAt', label: 'تاريخ التحديث' }
    ]
  }
];

let dynamicRegistry: SectionSchemaDefinition[] = [...CORE_SYSTEM_SECTIONS];

/**
 * Register any new section programmatically added to the codebase
 */
export function registerAppSection(section: SectionSchemaDefinition): void {
  const existingIdx = dynamicRegistry.findIndex(s => s.id === section.id);
  if (existingIdx > -1) {
    dynamicRegistry[existingIdx] = section;
  } else {
    dynamicRegistry.push(section);
  }
}

/**
 * Auto-synchronize all sections and fields to Firebase Firestore & Google Sheets.
 * Called automatically when the application starts or when a new section is saved.
 * Guaranteed to NEVER wipe old data (uses { merge: true } in Firestore and dynamic column expansion in Sheets).
 */
export async function autoSyncAllSchemas(customSections: CustomSection[] = []): Promise<void> {
  try {
    // 1. Gather all core sections + all custom sections
    const allSections: SectionSchemaDefinition[] = [...dynamicRegistry];

    customSections.forEach(cs => {
      if (!allSections.some(s => s.id === cs.id)) {
        allSections.push({
          id: cs.id,
          name: cs.title.replace(/\s+/g, '_'),
          title: cs.title,
          isCustom: true,
          fields: [
            { key: 'id', label: 'المعرف' },
            ...(cs.fields || []).map(f => ({
              key: f.name || f.id,
              label: f.label || f.name,
              type: f.type
            })),
            { key: 'createdAt', label: 'تاريخ الإنشاء' },
            { key: 'updatedAt', label: 'تاريخ التحديث' }
          ]
        });
      }
      if (cs.subSections && cs.subSections.length > 0) {
        cs.subSections.forEach(sub => {
          const subKey = `${cs.id}__${sub.id}`;
          if (!allSections.some(s => s.id === subKey)) {
            allSections.push({
              id: subKey,
              name: `${cs.title}_${sub.title}`.replace(/\s+/g, '_'),
              title: `${cs.title} - ${sub.title}`,
              isCustom: true,
              fields: [
                { key: 'id', label: 'المعرف' },
                ...(sub.fields || []).map(f => ({
                  key: f.name || f.id,
                  label: f.label || f.name,
                  type: f.type
                })),
                { key: 'createdAt', label: 'تاريخ الإنشاء' },
                { key: 'updatedAt', label: 'تاريخ التحديث' }
              ]
            });
          }
        });
      }
    });

    // 2. Persist active schema manifest in Firebase Firestore (settings/schema_manifest) with merge: true
    try {
      await setDoc(doc(db, 'settings', 'schema_manifest'), {
        sections: allSections,
        totalSections: allSections.length,
        syncedAt: new Date().toISOString(),
        version: '2026.4.0',
        platform: 'dual_sync_firebase_sheets'
      }, { merge: true });
    } catch (fsErr) {
      console.warn('[Schema Auto-Discovery] Firestore schema registration note:', fsErr);
    }

    // 3. Only notify Google Apps Script for custom sections so core sheets stay strictly locked to their clean Arabic column schema
    const customOnly = allSections.filter(s => s.isCustom);
    if (customOnly.length > 0) {
      await syncSchemaToGoogleAppsScript(customOnly);
    }
    console.log(`[Dual-Sync] Schema auto-discovery verified ${allSections.length} sections (${customOnly.length} custom synced to Sheets).`);
  } catch (err) {
    console.warn('[Schema Auto-Discovery] Sync note:', err);
  }
}
