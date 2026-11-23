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
  USERS_SHEET_HEADERS
} from './googleSheetsSchema';

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
    id: 'letters',
    name: LETTERS_SHEET_NAME,
    title: 'قسم المكنة والكتب الرسمية',
    fields: LETTERS_SHEET_HEADERS.map(h => ({ key: h, label: h }))
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

export async function autoSyncAllSchemas(_customSections: CustomSection[] = []): Promise<void> {
  try {
    const allSections: SectionSchemaDefinition[] = [...dynamicRegistry];
    try {
      await setDoc(doc(db, 'settings', 'schema_manifest'), {
        sections: allSections,
        totalSections: allSections.length,
        syncedAt: new Date().toISOString(),
        version: '2026.5.0-one-sheet-per-department',
        platform: 'dual_sync_firebase_sheets'
      }, { merge: true });
    } catch {
      // Ignore if Firestore rules/project disallow manifest write
    }
  } catch (err) {
    console.warn('[Schema Auto-Discovery] Sync note:', err);
  }
}
