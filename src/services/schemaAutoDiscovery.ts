import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CustomSection } from '../types';
import {
  CITIZENS_SHEET_NAME,
  CITIZENS_SHEET_HEADERS,
  REQUESTS_SHEET_NAME,
  REQUESTS_SHEET_HEADERS,
  INTERVIEWS_SHEET_NAME,
  INTERVIEWS_SHEET_HEADERS,
  ORGANIZATION_SHEET_NAME,
  ORGANIZATION_SHEET_HEADERS,
  LETTERS_SHEET_NAME,
  LETTERS_SHEET_HEADERS,
  CHEQUES_SHEET_NAME,
  CHEQUES_SHEET_HEADERS,
  SOCIAL_CARE_SHEET_NAME,
  SOCIAL_CARE_SHEET_HEADERS,
  USERS_SHEET_NAME,
  USERS_SHEET_HEADERS,
  buildCustomSectionSheetName,
  buildCustomSectionHeaders
} from './googleSheetsSchema';
import { syncSchemaToGoogleAppsScript, setRuntimeCustomSections } from './realtimeGoogleSync';

export interface SectionSchemaDefinition {
  id: string;
  name: string;
  title: string;
  fields: { key: string; label: string; type?: string }[];
  isCustom?: boolean;
}

// 1. Core Built-In Sections Schema Registry (One Single Sheet Per Department)
export const CORE_SYSTEM_SECTIONS: SectionSchemaDefinition[] = [
  {
    id: 'citizens',
    name: CITIZENS_SHEET_NAME,
    title: 'قسم الاستعلامات والمراجعين',
    fields: CITIZENS_SHEET_HEADERS.map(h => ({ key: h, label: h }))
  },
  {
    id: 'requests',
    name: REQUESTS_SHEET_NAME,
    title: 'قسم الإدارة والمعاملات',
    fields: REQUESTS_SHEET_HEADERS.map(h => ({ key: h, label: h }))
  },
  {
    id: 'interviews',
    name: INTERVIEWS_SHEET_NAME,
    title: 'قسم مقابلات النائب',
    fields: INTERVIEWS_SHEET_HEADERS.map(h => ({ key: h, label: h }))
  },
  {
    id: 'organization',
    name: ORGANIZATION_SHEET_NAME,
    title: 'قسم التنظيم والجماهير',
    fields: ORGANIZATION_SHEET_HEADERS.map(h => ({ key: h, label: h }))
  },
  {
    id: 'cheques',
    name: CHEQUES_SHEET_NAME,
    title: 'قسم المساعدات والصكوك',
    fields: CHEQUES_SHEET_HEADERS.map(h => ({ key: h, label: h }))
  },
  {
    id: 'sec_social_welfare',
    name: SOCIAL_CARE_SHEET_NAME,
    title: 'قسم الرعاية الاجتماعية',
    fields: SOCIAL_CARE_SHEET_HEADERS.map(h => ({ key: h, label: h }))
  },
  {
    id: 'users',
    name: USERS_SHEET_NAME,
    title: 'قسم الرقابة والمستخدمين',
    fields: USERS_SHEET_HEADERS.map(h => ({ key: h, label: h }))
  }
];

let dynamicRegistry: SectionSchemaDefinition[] = [...CORE_SYSTEM_SECTIONS];

export function registerAppSection(section: SectionSchemaDefinition): void {
  const existingIdx = dynamicRegistry.findIndex(s => s.id === section.id);
  if (existingIdx > -1) {
    dynamicRegistry[existingIdx] = section;
  } else {
    dynamicRegistry.push(section);
  }
}

export function buildCustomSectionsSchemaDefinitions(customSections: CustomSection[]): SectionSchemaDefinition[] {
  const defs: SectionSchemaDefinition[] = [];
  for (const sec of customSections || []) {
    if (!sec || !sec.id || sec.id === 'sec_social_welfare') continue;

    if (sec.isMultiSectionHub && Array.isArray(sec.subSections) && sec.subSections.length > 0) {
      for (const sub of sec.subSections) {
        if (!sub || sub.targetBuiltInSection) continue;
        const compositeId = `${sec.id}__${sub.id}`;
        const sheetName = buildCustomSectionSheetName(sec.title, sub.title);
        const headers = buildCustomSectionHeaders(sub.fields || []);
        defs.push({
          id: compositeId,
          name: sheetName,
          title: `${sec.title} - ${sub.title}`,
          fields: headers.map(h => ({ key: h, label: h })),
          isCustom: true
        });
      }
    } else {
      const sheetName = buildCustomSectionSheetName(sec.title);
      const headers = buildCustomSectionHeaders(sec.fields || []);
      defs.push({
        id: sec.id,
        name: sheetName,
        title: sec.title,
        fields: headers.map(h => ({ key: h, label: h })),
        isCustom: true
      });
    }
  }
  return defs;
}

export async function autoSyncAllSchemas(
  customSections: CustomSection[] = [],
  appsScriptUrl?: string
): Promise<{ firestoreOk: boolean; sheetsOk: boolean; sheetsError?: string }> {
  let firestoreOk = false;
  let sheetsOk = true;
  let sheetsError: string | undefined;

  try {
    setRuntimeCustomSections(customSections);

    const customDefs = buildCustomSectionsSchemaDefinitions(customSections);
    customDefs.forEach(registerAppSection);

    const allSections: SectionSchemaDefinition[] = [
      ...CORE_SYSTEM_SECTIONS,
      ...customDefs
    ];

    try {
      await setDoc(
        doc(db, 'settings', 'schema_manifest'),
        {
          sections: allSections,
          totalSections: allSections.length,
          customSectionsCount: customDefs.length,
          syncedAt: new Date().toISOString(),
          version: '2026.5.2-dynamic-sheets',
          platform: 'dual_sync_firebase_sheets'
        },
        { merge: true }
      );
      firestoreOk = true;
    } catch (err) {
      console.warn('[Schema Auto-Discovery] Firestore manifest write warning:', err);
    }

    if (customDefs.length > 0) {
      const sheetRes = await syncSchemaToGoogleAppsScript(customSections, appsScriptUrl);
      sheetsOk = sheetRes.success;
      sheetsError = sheetRes.error;
    }
  } catch (err: any) {
    console.warn('[Schema Auto-Discovery] Sync warning:', err);
    sheetsOk = false;
    sheetsError = err?.message;
  }

  return { firestoreOk, sheetsOk, sheetsError };
}
