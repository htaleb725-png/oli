import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  Citizen, 
  OfficeRequest, 
  Interview, 
  OfficialLetter, 
  OrganizationRecord, 
  AuditLog, 
  ChequeRecord, 
  User, 
  SystemSettings,
  DropdownItem,
  DynamicField
} from '../types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const STORAGE_KEY_SUPABASE_URL = 'al_nashi_supabase_url';
const STORAGE_KEY_SUPABASE_KEY = 'al_nashi_supabase_key';

let cachedClient: SupabaseClient | null = null;
let cachedClientUrl = '';
let cachedClientKey = '';

/**
 * Retrieve Supabase configuration from localStorage or Vite environment variables.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || '') : '';
  const localKey = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) || '') : '';

  return {
    url: (localUrl || envUrl || '').trim(),
    anonKey: (localKey || envKey || '').trim(),
  };
}

/**
 * Save Supabase configuration to localStorage and reset cached client.
 */
export function saveSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_SUPABASE_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_SUPABASE_KEY, anonKey.trim());
  }
  cachedClient = null;
  cachedClientUrl = '';
  cachedClientKey = '';
}

/**
 * Clear stored Supabase configuration.
 */
export function clearSupabaseConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_SUPABASE_URL);
    localStorage.removeItem(STORAGE_KEY_SUPABASE_KEY);
  }
  cachedClient = null;
  cachedClientUrl = '';
  cachedClientKey = '';
}

/**
 * Check if Supabase credentials are configured.
 */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith('http'));
}

/**
 * Get or initialize the Supabase client instance.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey || !url.startsWith('http')) {
    return null;
  }

  if (cachedClient && cachedClientUrl === url && cachedClientKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    cachedClientUrl = url;
    cachedClientKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

/**
 * Test connectivity with Supabase and verify whether core tables exist.
 */
export interface TableStatus {
  tableName: string;
  titleArabic: string;
  exists: boolean;
  count: number;
  error?: string;
}

export interface SupabaseHealthCheckResult {
  connected: boolean;
  message: string;
  projectHost?: string;
  tables: TableStatus[];
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthCheckResult> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      connected: false,
      message: 'لم يتم إدخال بيانات الربط بقاعدة بيانات Supabase (الرابط والمفتاح).',
      tables: [],
    };
  }

  const { url } = getSupabaseConfig();
  let projectHost = '';
  try {
    projectHost = new URL(url).hostname;
  } catch {
    projectHost = url;
  }

  const requiredTables: { name: string; title: string }[] = [
    { name: 'citizens', title: 'المواطنون والمراجعون' },
    { name: 'requests', title: 'الطلبات والمعاملات' },
    { name: 'interviews', title: 'المقابلات الرسمية' },
    { name: 'official_letters', title: 'الكتب والمخاطبات' },
    { name: 'organization_records', title: 'السجل التنظيمي والتقييمات' },
    { name: 'cheques', title: 'الصكوك والمساعدات' },
    { name: 'audit_logs', title: 'سجل النشاطات والأمان' },
    { name: 'users', title: 'المستخدمون والموظفون' },
    { name: 'system_settings', title: 'إعدادات النظام العامة' },
    { name: 'dropdowns', title: 'القوائم المنسدلة والعشائر' },
    { name: 'dynamic_fields', title: 'الحقول الديناميكية للأقسام' },
  ];

  const tableResults: TableStatus[] = [];
  let atLeastOneSuccess = false;

  for (const t of requiredTables) {
    try {
      const { count, error } = await client
        .from(t.name)
        .select('*', { count: 'exact', head: true });

      if (error) {
        tableResults.push({
          tableName: t.name,
          titleArabic: t.title,
          exists: false,
          count: 0,
          error: error.message,
        });
      } else {
        atLeastOneSuccess = true;
        tableResults.push({
          tableName: t.name,
          titleArabic: t.title,
          exists: true,
          count: count || 0,
        });
      }
    } catch (err: any) {
      tableResults.push({
        tableName: t.name,
        titleArabic: t.title,
        exists: false,
        count: 0,
        error: err?.message || 'خطأ في الاتصال',
      });
    }
  }

  const allExist = tableResults.every(t => t.exists);

  return {
    connected: atLeastOneSuccess || allExist,
    message: allExist 
      ? 'الاتصال بقاعدة بيانات Supabase سليم، وجميع الجداول والأعمدة جاهزة للعمل.' 
      : atLeastOneSuccess 
        ? 'تم الاتصال بـ Supabase بنجاح، لكن بعض الجداول تحتاج لإنشاء عبر تشغيل كود SQL.' 
        : 'تم الاتصال بالخادم، لكن لم يتم العثور على الجداول المطلوبة. يرجى تنفيذ كود SQL المرفق لإنشاء الأعمدة والجداول.',
    projectHost,
    tables: tableResults,
  };
}

/**
 * Generate complete, production-grade PostgreSQL DDL for Supabase.
 * Creates all tables, columns, indexes, and sets public permissions.
 */
export function generateSupabaseFullSchemaSQL(): string {
  return `-- =========================================================================
-- مخطط قاعدة بيانات مكتب النائب علا الناشي - نظام الإدارة المركزي الشامل (Supabase SQL)
-- تم إعداده لإنشاء كافة الأعمدة والجداول تلقائياً مع صلاحيات القراءة والحفظ والاستعلام
-- =========================================================================

-- 1. جدول المواطنين والمراجعين (citizens)
CREATE TABLE IF NOT EXISTS public.citizens (
    "Citizen_ID" TEXT PRIMARY KEY,
    "FirstName" TEXT,
    "FatherName" TEXT,
    "GrandFatherName" TEXT,
    "GreatGrandFatherName" TEXT,
    "Surname" TEXT,
    "FullName" TEXT NOT NULL,
    "Phone1" TEXT NOT NULL,
    "Phone2" TEXT,
    "National_ID" TEXT,
    "Job" TEXT,
    "Education" TEXT,
    "Gender" TEXT,
    "Rating" TEXT,
    "District" TEXT,
    "SubDistrict" TEXT,
    "ReferralSource" TEXT,
    "CreatedAt" TEXT,
    "CreatedBy" TEXT,
    "CurrentStage" TEXT,
    "WorkflowHistory" JSONB DEFAULT '[]'::jsonb,
    "CustomFields" JSONB DEFAULT '{}'::jsonb,
    "PhotoUrl" TEXT,
    "RegisteredVia" TEXT,
    "AttendanceType" TEXT,
    "ProxyName" TEXT,
    "ProxyPhone" TEXT,
    "ProxyAddress" TEXT,
    "ProxyRelation" TEXT,
    "DependencyStatus" TEXT,
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- إضافة أي أعمدة مفقودة إذا كان الجدول موجوداً مسبقاً
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "FirstName" TEXT;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "FatherName" TEXT;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "GrandFatherName" TEXT;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "GreatGrandFatherName" TEXT;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "Surname" TEXT;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "RegisteredVia" TEXT;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "AttendanceType" TEXT;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "ProxyName" TEXT;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "ProxyPhone" TEXT;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "ProxyAddress" TEXT;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "ProxyRelation" TEXT;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "DependencyStatus" TEXT;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "WorkflowHistory" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS "CustomFields" JSONB DEFAULT '{}'::jsonb;

-- 2. جدول الطلبات والمعاملات الإدارية (requests)
CREATE TABLE IF NOT EXISTS public.requests (
    "Request_ID" TEXT PRIMARY KEY,
    "Citizen_ID" TEXT REFERENCES public.citizens("Citizen_ID") ON DELETE SET NULL,
    "CitizenName" TEXT,
    "CitizenPhone" TEXT,
    "Entity" TEXT,
    "RequestStatus" TEXT,
    "ProcessingStatus" TEXT,
    "Priority" TEXT,
    "Details" TEXT,
    "AttachmentRequest" TEXT,
    "AttachmentResponse" TEXT,
    "AttachedRequestImage" TEXT,
    "ScanUploadedBy" TEXT,
    "ScanUploadedAt" TEXT,
    "ScanAttachments" JSONB DEFAULT '[]'::jsonb,
    "CreatedAt" TEXT,
    "CreatedDate" TEXT,
    "CreatedBy" TEXT,
    "CurrentStage" TEXT,
    "WorkflowHistory" JSONB DEFAULT '[]'::jsonb,
    "DeputyNotes" TEXT,
    "ExecutiveAction" TEXT,
    "OutgoingNumber" TEXT,
    "OutgoingDate" TEXT,
    "IsKhadamatAlliance" BOOLEAN DEFAULT false,
    "RegisteredVia" TEXT,
    "AttendanceType" TEXT,
    "ProxyName" TEXT,
    "ProxyPhone" TEXT,
    "ProxyAddress" TEXT,
    "ProxyRelation" TEXT,
    "DependencyStatus" TEXT,
    "GeneratedAiDraft" TEXT,
    "CustomFields" JSONB DEFAULT '{}'::jsonb,
    "DirectorDecision" TEXT,
    "DirectorNotes" TEXT,
    "DirectorDecisionDate" TEXT,
    "DirectorDecisionBy" TEXT,
    "ReceptionNotes" TEXT,
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- تحديث الأعمدة في حال وجود الجدول
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS "ScanAttachments" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS "DeputyNotes" TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS "ExecutiveAction" TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS "OutgoingNumber" TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS "OutgoingDate" TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS "IsKhadamatAlliance" BOOLEAN DEFAULT false;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS "DirectorDecision" TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS "DirectorNotes" TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS "DirectorDecisionDate" TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS "DirectorDecisionBy" TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS "ReceptionNotes" TEXT;

-- 3. جدول المقابلات الرسمية (interviews)
CREATE TABLE IF NOT EXISTS public.interviews (
    "Interview_ID" TEXT PRIMARY KEY,
    "Citizen_ID" TEXT,
    "FullName" TEXT NOT NULL,
    "CitizenName" TEXT,
    "Subject" TEXT,
    "Phone1" TEXT,
    "Phone2" TEXT,
    "Address" TEXT,
    "Referrer" TEXT,
    "InterviewDate" TEXT,
    "InterviewTime" TEXT,
    "Priority" TEXT,
    "Status" TEXT,
    "DeputyNotes" TEXT,
    "DeputyDirective" TEXT,
    "Directive" TEXT,
    "Outcome" TEXT,
    "ConvertedToRequest" BOOLEAN DEFAULT false,
    "CreatedAt" TEXT,
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. جدول الكتب والمخاطبات الرسمية (official_letters)
CREATE TABLE IF NOT EXISTS public.official_letters (
    "Letter_ID" TEXT PRIMARY KEY,
    "LetterNumber" TEXT,
    "LetterDate" TEXT,
    "Recipient" TEXT,
    "Subject" TEXT,
    "Body" TEXT,
    "Citizen_ID" TEXT,
    "CitizenName" TEXT,
    "Request_ID" TEXT,
    "Status" TEXT,
    "ClerkName" TEXT,
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. جدول السجل التنظيمي والتقييمات (organization_records)
CREATE TABLE IF NOT EXISTS public.organization_records (
    "Org_ID" TEXT PRIMARY KEY,
    "Citizen_ID" TEXT NOT NULL,
    "FullName" TEXT NOT NULL,
    "District" TEXT,
    "SubDistrict" TEXT,
    "Phone1" TEXT,
    "Phone" TEXT,
    "OrgRating" TEXT,
    "Rating" TEXT,
    "RoleType" TEXT,
    "ReferralCount" INTEGER DEFAULT 0,
    "InfluenceType" TEXT,
    "EvaluationPoints" INTEGER DEFAULT 0,
    "ElectionCenter" TEXT,
    "StationNumber" TEXT,
    "Notes" TEXT,
    "Referrer" TEXT,
    "finalEvaluation" JSONB DEFAULT '{}'::jsonb,
    "isTeamMember" BOOLEAN DEFAULT false,
    "teamMemberRole" TEXT,
    "CustomFields" JSONB DEFAULT '{}'::jsonb,
    "UpdatedAt" TEXT,
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 6. جدول الصكوك والمساعدات المالية (cheques)
CREATE TABLE IF NOT EXISTS public.cheques (
    "id" TEXT PRIMARY KEY,
    "ChequeNumber" TEXT NOT NULL,
    "Citizen_ID" TEXT,
    "CitizenName" TEXT NOT NULL,
    "CitizenPhone" TEXT,
    "Request_ID" TEXT,
    "Amount" NUMERIC DEFAULT 0,
    "AmountInWords" TEXT,
    "BankName" TEXT,
    "Purpose" TEXT,
    "IssueDate" TEXT,
    "DueDate" TEXT,
    "Status" TEXT DEFAULT 'قيد الصرف',
    "BeneficiaryGender" TEXT,
    "DependencyStatus" TEXT,
    "AttendanceType" TEXT,
    "Notes" TEXT,
    "CreatedBy" TEXT,
    "CreatedAt" TEXT,
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 7. جدول سجل النشاطات والتدقيق (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    "Log_ID" TEXT PRIMARY KEY,
    "Timestamp" TEXT,
    "UserName" TEXT,
    "User" TEXT,
    "PerformedBy" TEXT,
    "ActionType" TEXT,
    "Action" TEXT,
    "Department" TEXT,
    "Section" TEXT,
    "Details" TEXT,
    "Ip" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 8. جدول المستخدمين وحسابات الموظفين (users)
CREATE TABLE IF NOT EXISTS public.users (
    "User_ID" TEXT PRIMARY KEY,
    "Username" TEXT UNIQUE NOT NULL,
    "Password" TEXT,
    "Role" TEXT NOT NULL,
    "RoleArabic" TEXT,
    "Status" TEXT DEFAULT 'active',
    "Active" BOOLEAN DEFAULT true,
    "FullName" TEXT NOT NULL,
    "Department" TEXT,
    "Avatar" TEXT,
    "Permissions" JSONB DEFAULT '[]'::jsonb,
    "CreatedAt" TEXT,
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 9. جدول إعدادات النظام العامة (system_settings)
CREATE TABLE IF NOT EXISTS public.system_settings (
    "key" TEXT PRIMARY KEY,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 10. جدول القوائم المنسدلة والعشائر (dropdowns)
CREATE TABLE IF NOT EXISTS public.dropdowns (
    "id" TEXT PRIMARY KEY,
    "Category" TEXT NOT NULL,
    "ItemValue" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 11. جدول الحقول الديناميكية للأقسام (dynamic_fields)
CREATE TABLE IF NOT EXISTS public.dynamic_fields (
    "id" TEXT PRIMARY KEY,
    "section" TEXT NOT NULL,
    "sectionArabic" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "options" JSONB DEFAULT '[]'::jsonb,
    "required" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء فهارس سريعة لتعزيز سرعة الاستعلامات والبحث
CREATE INDEX IF NOT EXISTS idx_citizens_fullname ON public.citizens("FullName");
CREATE INDEX IF NOT EXISTS idx_citizens_phone1 ON public.citizens("Phone1");
CREATE INDEX IF NOT EXISTS idx_requests_citizenid ON public.requests("Citizen_ID");
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests("RequestStatus");
CREATE INDEX IF NOT EXISTS idx_requests_priority ON public.requests("Priority");
CREATE INDEX IF NOT EXISTS idx_cheques_number ON public.cheques("ChequeNumber");
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_logs("Timestamp");
CREATE INDEX IF NOT EXISTS idx_dropdowns_category ON public.dropdowns("Category");

-- تفعيل سياسات الأمان والحماية (Row Level Security) مع إتاحة الوصول للقراءة والكتابة
ALTER TABLE public.citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_fields ENABLE ROW LEVEL SECURITY;

-- سياسات عامة للوصول (تتيح القراءة والتعديل من خلال المفتاح Anon والمستخدمين المصرح لهم)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public access policy citizens" ON public.citizens;
    CREATE POLICY "Public access policy citizens" ON public.citizens FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access policy requests" ON public.requests;
    CREATE POLICY "Public access policy requests" ON public.requests FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access policy interviews" ON public.interviews;
    CREATE POLICY "Public access policy interviews" ON public.interviews FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access policy letters" ON public.official_letters;
    CREATE POLICY "Public access policy letters" ON public.official_letters FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access policy org" ON public.organization_records;
    CREATE POLICY "Public access policy org" ON public.organization_records FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access policy cheques" ON public.cheques;
    CREATE POLICY "Public access policy cheques" ON public.cheques FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access policy audit" ON public.audit_logs;
    CREATE POLICY "Public access policy audit" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access policy users" ON public.users;
    CREATE POLICY "Public access policy users" ON public.users FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access policy settings" ON public.system_settings;
    CREATE POLICY "Public access policy settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access policy dropdowns" ON public.dropdowns;
    CREATE POLICY "Public access policy dropdowns" ON public.dropdowns FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access policy dynamic_fields" ON public.dynamic_fields;
    CREATE POLICY "Public access policy dynamic_fields" ON public.dynamic_fields FOR ALL USING (true) WITH CHECK (true);
END $$;
`;
}

// -------------------------------------------------------------
// CRUD Operations for System Entities in Supabase
// -------------------------------------------------------------

/**
 * Citizens
 */
export async function fetchCitizensFromSupabase(): Promise<Citizen[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('citizens').select('*');
  if (error) {
    console.error('Error fetching citizens from Supabase:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    ...row,
    WorkflowHistory: Array.isArray(row.WorkflowHistory) ? row.WorkflowHistory : [],
    CustomFields: typeof row.CustomFields === 'object' && row.CustomFields ? row.CustomFields : {},
  }));
}

export async function upsertCitizenToSupabase(citizen: Citizen): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !citizen || !citizen.Citizen_ID) return false;

  const payload: any = {
    Citizen_ID: citizen.Citizen_ID,
    FirstName: citizen.FirstName || '',
    FatherName: citizen.FatherName || '',
    GrandFatherName: citizen.GrandFatherName || '',
    GreatGrandFatherName: citizen.GreatGrandFatherName || '',
    Surname: citizen.Surname || '',
    FullName: citizen.FullName || 'مواطن',
    Phone1: citizen.Phone1 || '',
    Phone2: citizen.Phone2 || '',
    National_ID: citizen.National_ID || '',
    Job: citizen.Job || '',
    Education: citizen.Education || '',
    Gender: citizen.Gender || 'ذكر',
    Rating: citizen.Rating || 'لائق',
    District: citizen.District || '',
    SubDistrict: citizen.SubDistrict || '',
    ReferralSource: citizen.ReferralSource || '',
    CreatedAt: citizen.CreatedAt || new Date().toISOString(),
    CreatedBy: citizen.CreatedBy || '',
    CurrentStage: citizen.CurrentStage || 'الاستعلامات',
    WorkflowHistory: citizen.WorkflowHistory || [],
    CustomFields: citizen.CustomFields || {},
    PhotoUrl: citizen.PhotoUrl || '',
    RegisteredVia: citizen.RegisteredVia || '',
    AttendanceType: citizen.AttendanceType || 'شخصياً',
    ProxyName: citizen.ProxyName || '',
    ProxyPhone: citizen.ProxyPhone || '',
    ProxyAddress: citizen.ProxyAddress || '',
    ProxyRelation: citizen.ProxyRelation || '',
    DependencyStatus: citizen.DependencyStatus || 'مستقل',
  };

  const { error } = await client.from('citizens').upsert(payload, { onConflict: 'Citizen_ID' });
  if (error) {
    console.error('Error upserting citizen to Supabase:', error);
    return false;
  }
  return true;
}

export async function deleteCitizenFromSupabase(citizenId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !citizenId) return false;
  const { error } = await client.from('citizens').delete().eq('Citizen_ID', citizenId);
  return !error;
}

/**
 * Requests
 */
export async function fetchRequestsFromSupabase(): Promise<OfficeRequest[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('requests').select('*');
  if (error) {
    console.error('Error fetching requests from Supabase:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    ...row,
    ScanAttachments: Array.isArray(row.ScanAttachments) ? row.ScanAttachments : [],
    WorkflowHistory: Array.isArray(row.WorkflowHistory) ? row.WorkflowHistory : [],
    CustomFields: typeof row.CustomFields === 'object' && row.CustomFields ? row.CustomFields : {},
  }));
}

export async function upsertRequestToSupabase(req: OfficeRequest): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !req || !req.Request_ID) return false;

  const payload: any = {
    Request_ID: req.Request_ID,
    Citizen_ID: req.Citizen_ID || null,
    CitizenName: req.CitizenName || '',
    CitizenPhone: req.CitizenPhone || '',
    Entity: req.Entity || '',
    RequestStatus: req.RequestStatus || 'مستلم',
    ProcessingStatus: req.ProcessingStatus || 'قيد الإجراء',
    Priority: req.Priority || 'عام',
    Details: req.Details || '',
    AttachmentRequest: req.AttachmentRequest || '',
    AttachmentResponse: req.AttachmentResponse || '',
    AttachedRequestImage: req.AttachedRequestImage || '',
    ScanUploadedBy: req.ScanUploadedBy || '',
    ScanUploadedAt: req.ScanUploadedAt || '',
    ScanAttachments: req.ScanAttachments || [],
    CreatedAt: req.CreatedAt || new Date().toISOString(),
    CreatedDate: req.CreatedDate || '',
    CreatedBy: req.CreatedBy || '',
    CurrentStage: req.CurrentStage || 'الاستعلامات',
    WorkflowHistory: req.WorkflowHistory || [],
    DeputyNotes: req.DeputyNotes || '',
    ExecutiveAction: req.ExecutiveAction || '',
    OutgoingNumber: req.OutgoingNumber || '',
    OutgoingDate: req.OutgoingDate || '',
    IsKhadamatAlliance: req.IsKhadamatAlliance || false,
    RegisteredVia: req.RegisteredVia || '',
    AttendanceType: req.AttendanceType || 'شخصياً',
    ProxyName: req.ProxyName || '',
    ProxyPhone: req.ProxyPhone || '',
    ProxyAddress: req.ProxyAddress || '',
    ProxyRelation: req.ProxyRelation || '',
    DependencyStatus: req.DependencyStatus || 'مستقل',
    GeneratedAiDraft: req.GeneratedAiDraft || '',
    CustomFields: req.CustomFields || {},
    DirectorDecision: req.DirectorDecision || '',
    DirectorNotes: req.DirectorNotes || '',
    DirectorDecisionDate: req.DirectorDecisionDate || '',
    DirectorDecisionBy: req.DirectorDecisionBy || '',
    ReceptionNotes: req.ReceptionNotes || '',
  };

  const { error } = await client.from('requests').upsert(payload, { onConflict: 'Request_ID' });
  if (error) {
    console.error('Error upserting request to Supabase:', error);
    return false;
  }
  return true;
}

export async function deleteRequestFromSupabase(requestId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !requestId) return false;
  const { error } = await client.from('requests').delete().eq('Request_ID', requestId);
  return !error;
}

/**
 * Interviews
 */
export async function fetchInterviewsFromSupabase(): Promise<Interview[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('interviews').select('*');
  if (error) {
    console.error('Error fetching interviews from Supabase:', error);
    return [];
  }
  return data || [];
}

export async function upsertInterviewToSupabase(interview: Interview): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !interview || !interview.Interview_ID) return false;

  const payload: any = {
    Interview_ID: interview.Interview_ID,
    Citizen_ID: interview.Citizen_ID || null,
    FullName: interview.FullName || interview.CitizenName || 'مراجع',
    CitizenName: interview.CitizenName || interview.FullName || '',
    Subject: interview.Subject || '',
    Phone1: interview.Phone1 || '',
    Phone2: interview.Phone2 || '',
    Address: interview.Address || '',
    Referrer: interview.Referrer || '',
    InterviewDate: interview.InterviewDate || '',
    InterviewTime: interview.InterviewTime || '',
    Priority: interview.Priority || 'عادي',
    Status: interview.Status || 'مجدولة',
    DeputyNotes: interview.DeputyNotes || '',
    DeputyDirective: interview.DeputyDirective || '',
    Directive: interview.Directive || '',
    Outcome: interview.Outcome || '',
    ConvertedToRequest: interview.ConvertedToRequest || false,
    CreatedAt: interview.CreatedAt || new Date().toISOString(),
  };

  const { error } = await client.from('interviews').upsert(payload, { onConflict: 'Interview_ID' });
  return !error;
}

export async function deleteInterviewFromSupabase(interviewId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !interviewId) return false;
  const { error } = await client.from('interviews').delete().eq('Interview_ID', interviewId);
  return !error;
}

/**
 * Official Letters
 */
export async function fetchOfficialLettersFromSupabase(): Promise<OfficialLetter[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('official_letters').select('*');
  if (error) {
    console.error('Error fetching official letters from Supabase:', error);
    return [];
  }
  return data || [];
}

export async function upsertOfficialLetterToSupabase(letter: OfficialLetter): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !letter || !letter.Letter_ID) return false;

  const payload: any = {
    Letter_ID: letter.Letter_ID,
    LetterNumber: letter.LetterNumber || letter.Letter_Number || '',
    LetterDate: letter.LetterDate || letter.Letter_Date || '',
    Recipient: letter.Recipient || letter.To_Entity || '',
    Subject: letter.Subject || '',
    Body: letter.Body || '',
    Citizen_ID: letter.Citizen_ID || null,
    CitizenName: letter.CitizenName || letter.Citizen_Name || '',
    Request_ID: letter.Request_ID || null,
    Status: letter.Status || 'صادر',
    ClerkName: letter.ClerkName || '',
  };

  const { error } = await client.from('official_letters').upsert(payload, { onConflict: 'Letter_ID' });
  return !error;
}

export async function deleteOfficialLetterFromSupabase(letterId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !letterId) return false;
  const { error } = await client.from('official_letters').delete().eq('Letter_ID', letterId);
  return !error;
}

/**
 * Organization Records
 */
export async function fetchOrganizationRecordsFromSupabase(): Promise<OrganizationRecord[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('organization_records').select('*');
  if (error) {
    console.error('Error fetching org records from Supabase:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    ...row,
    finalEvaluation: typeof row.finalEvaluation === 'object' ? row.finalEvaluation : undefined,
    CustomFields: typeof row.CustomFields === 'object' && row.CustomFields ? row.CustomFields : {},
  }));
}

export async function upsertOrganizationRecordToSupabase(record: OrganizationRecord): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !record) return false;

  const orgId = record.Org_ID || record.Citizen_ID;
  if (!orgId) return false;

  const payload: any = {
    Org_ID: orgId,
    Citizen_ID: record.Citizen_ID,
    FullName: record.FullName || 'عضو تنظيم',
    District: record.District || '',
    SubDistrict: record.SubDistrict || '',
    Phone1: record.Phone1 || record.Phone || '',
    Phone: record.Phone || record.Phone1 || '',
    OrgRating: record.OrgRating || record.Rating || 'مؤيد',
    Rating: record.Rating || record.OrgRating || 'مؤيد',
    RoleType: record.RoleType || '',
    ReferralCount: record.ReferralCount || 0,
    InfluenceType: record.InfluenceType || '',
    EvaluationPoints: record.EvaluationPoints || 0,
    ElectionCenter: record.ElectionCenter || '',
    StationNumber: record.StationNumber || '',
    Notes: record.Notes || '',
    Referrer: record.Referrer || '',
    finalEvaluation: record.finalEvaluation || {},
    isTeamMember: record.isTeamMember || false,
    teamMemberRole: record.teamMemberRole || '',
    CustomFields: record.CustomFields || {},
    UpdatedAt: record.UpdatedAt || new Date().toISOString(),
  };

  const { error } = await client.from('organization_records').upsert(payload, { onConflict: 'Org_ID' });
  return !error;
}

export async function deleteOrganizationRecordFromSupabase(orgId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !orgId) return false;
  const { error } = await client.from('organization_records').delete().eq('Org_ID', orgId);
  return !error;
}

/**
 * Cheques
 */
export async function fetchChequesFromSupabase(): Promise<ChequeRecord[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('cheques').select('*');
  if (error) {
    console.error('Error fetching cheques from Supabase:', error);
    return [];
  }
  return data || [];
}

export async function upsertChequeToSupabase(cheque: ChequeRecord): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !cheque || !cheque.id) return false;

  const payload: any = {
    id: cheque.id,
    ChequeNumber: cheque.ChequeNumber,
    Citizen_ID: cheque.Citizen_ID || null,
    CitizenName: cheque.CitizenName,
    CitizenPhone: cheque.CitizenPhone || '',
    Request_ID: cheque.Request_ID || null,
    Amount: cheque.Amount || 0,
    AmountInWords: cheque.AmountInWords || '',
    BankName: cheque.BankName || '',
    Purpose: cheque.Purpose || '',
    IssueDate: cheque.IssueDate || '',
    DueDate: cheque.DueDate || '',
    Status: cheque.Status || 'قيد الصرف',
    BeneficiaryGender: cheque.BeneficiaryGender || 'ذكر',
    DependencyStatus: cheque.DependencyStatus || 'مستقل',
    AttendanceType: cheque.AttendanceType || 'شخصياً',
    Notes: cheque.Notes || '',
    CreatedBy: cheque.CreatedBy || '',
    CreatedAt: cheque.CreatedAt || new Date().toISOString(),
  };

  const { error } = await client.from('cheques').upsert(payload, { onConflict: 'id' });
  return !error;
}

export async function deleteChequeFromSupabase(chequeId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !chequeId) return false;
  const { error } = await client.from('cheques').delete().eq('id', chequeId);
  return !error;
}

/**
 * Audit Logs
 */
export async function fetchAuditLogsFromSupabase(): Promise<AuditLog[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from('audit_logs')
    .select('*')
    .order('Timestamp', { ascending: false })
    .limit(200);
  if (error) {
    console.error('Error fetching audit logs from Supabase:', error);
    return [];
  }
  return data || [];
}

export async function insertAuditLogToSupabase(log: AuditLog): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !log) return false;

  const payload: any = {
    Log_ID: log.Log_ID || `LOG-${Date.now()}`,
    Timestamp: log.Timestamp || new Date().toISOString(),
    UserName: log.UserName || log.User || '',
    User: log.User || log.UserName || '',
    PerformedBy: log.PerformedBy || log.UserName || '',
    ActionType: log.ActionType || log.Action || '',
    Action: log.Action || log.ActionType || '',
    Department: log.Department || '',
    Section: log.Section || '',
    Details: log.Details || '',
    Ip: log.Ip || '',
  };

  const { error } = await client.from('audit_logs').insert(payload);
  return !error;
}

/**
 * Users
 */
export async function fetchUsersFromSupabase(): Promise<User[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('users').select('*');
  if (error) {
    console.error('Error fetching users from Supabase:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    ...row,
    Permissions: Array.isArray(row.Permissions) ? row.Permissions : [],
  }));
}

export async function upsertUserToSupabase(user: User): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !user || !user.User_ID) return false;

  const payload: any = {
    User_ID: user.User_ID,
    Username: user.Username,
    Password: user.Password || '',
    Role: user.Role,
    RoleArabic: user.RoleArabic || '',
    Status: user.Status || 'active',
    Active: user.Active !== false,
    FullName: user.FullName,
    Department: user.Department || '',
    Avatar: user.Avatar || '',
    Permissions: user.Permissions || [],
    CreatedAt: user.CreatedAt || new Date().toISOString(),
  };

  const { error } = await client.from('users').upsert(payload, { onConflict: 'User_ID' });
  return !error;
}

/**
 * System Settings
 */
export async function fetchSystemSettingsFromSupabase(): Promise<Partial<SystemSettings> | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('system_settings').select('*').eq('key', 'office_settings').single();
  if (error || !data) return null;
  return data.value as Partial<SystemSettings>;
}

export async function saveSystemSettingsToSupabase(settings: SystemSettings): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('system_settings').upsert({
    key: 'office_settings',
    value: settings,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  return !error;
}

/**
 * Dropdowns
 */
export async function fetchDropdownsFromSupabase(): Promise<DropdownItem[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('dropdowns').select('*');
  if (error) return [];
  return data || [];
}

export async function upsertDropdownToSupabase(item: DropdownItem): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !item || !item.ItemValue) return false;
  const id = item.id || `DD-${item.Category}-${item.ItemValue}`.replace(/\s+/g, '_');
  const { error } = await client.from('dropdowns').upsert({
    id,
    Category: item.Category,
    ItemValue: item.ItemValue
  }, { onConflict: 'id' });
  return !error;
}

/**
 * Dynamic Fields
 */
export async function fetchDynamicFieldsFromSupabase(): Promise<DynamicField[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('dynamic_fields').select('*');
  if (error) return [];
  return (data || []).map((row: any) => ({
    ...row,
    options: Array.isArray(row.options) ? row.options : [],
  }));
}

export async function upsertDynamicFieldToSupabase(field: DynamicField): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !field || !field.id) return false;
  const { error } = await client.from('dynamic_fields').upsert({
    id: field.id,
    section: field.section,
    sectionArabic: field.sectionArabic,
    fieldName: field.fieldName,
    fieldLabel: field.fieldLabel,
    fieldType: field.fieldType,
    options: field.options || [],
    required: field.required || false,
  }, { onConflict: 'id' });
  return !error;
}

/**
 * Smart Auto-Sync for Deployments (Vercel, Hostinger, GitHub push)
 * Automatically checks Supabase, preserves existing citizens and transactions,
 * and adds any newly defined departments/users/dropdowns/sections into Supabase.
 */
export interface AutoSyncOnBootParams {
  codeUsers: User[];
  codeDropdowns: DropdownItem[];
  codeDynamicFields: DynamicField[];
  codeSettings?: SystemSettings;
}

export interface AutoSyncOnBootResult {
  isSupabaseActive: boolean;
  restoredData?: {
    citizens: Citizen[];
    requests: OfficeRequest[];
    interviews: Interview[];
    officialLetters: OfficialLetter[];
    organizationRecords: OrganizationRecord[];
    cheques: ChequeRecord[];
    users: User[];
    dropdowns: DropdownItem[];
    dynamicFields: DynamicField[];
    settings: Partial<SystemSettings> | null;
  };
  newItemsAddedToSupabase: {
    usersCount: number;
    dropdownsCount: number;
    dynamicFieldsCount: number;
  };
  message: string;
}

export async function autoSyncNewCodeDataToSupabase(
  params: AutoSyncOnBootParams
): Promise<AutoSyncOnBootResult> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      isSupabaseActive: false,
      newItemsAddedToSupabase: { usersCount: 0, dropdownsCount: 0, dynamicFieldsCount: 0 },
      message: 'Supabase غير مهيأ.',
    };
  }

  try {
    // 1. Fetch current users in Supabase
    const dbUsers = await fetchUsersFromSupabase();
    const existingUsernames = new Set(dbUsers.map(u => (u.Username || '').toLowerCase()));
    const existingUserIds = new Set(dbUsers.map(u => u.User_ID));

    // Check if new users/departments were added in code/GitHub commit
    let newUsersAdded = 0;
    for (const codeUser of params.codeUsers) {
      const uName = (codeUser.Username || '').toLowerCase();
      if (!existingUsernames.has(uName) && !existingUserIds.has(codeUser.User_ID)) {
        const ok = await upsertUserToSupabase(codeUser);
        if (ok) newUsersAdded++;
      }
    }

    // 2. Fetch current dropdowns in Supabase
    const dbDropdowns = await fetchDropdownsFromSupabase();
    const existingDropdownPairs = new Set(dbDropdowns.map(d => `${d.Category}:${d.ItemValue}`.toLowerCase()));

    let newDropdownsAdded = 0;
    for (const d of params.codeDropdowns) {
      const key = `${d.Category}:${d.ItemValue}`.toLowerCase();
      if (!existingDropdownPairs.has(key)) {
        const ok = await upsertDropdownToSupabase(d);
        if (ok) newDropdownsAdded++;
      }
    }

    // 3. Fetch current dynamic fields in Supabase
    const dbDynamicFields = await fetchDynamicFieldsFromSupabase();
    const existingFieldIds = new Set(dbDynamicFields.map(f => f.id));

    let newFieldsAdded = 0;
    for (const f of params.codeDynamicFields) {
      if (!existingFieldIds.has(f.id)) {
        const ok = await upsertDynamicFieldToSupabase(f);
        if (ok) newFieldsAdded++;
      }
    }

    // 4. Fetch all existing records from Supabase to preserve live data across deployments
    const [citizens, requests, interviews, officialLetters, organizationRecords, cheques] = await Promise.all([
      fetchCitizensFromSupabase(),
      fetchRequestsFromSupabase(),
      fetchInterviewsFromSupabase(),
      fetchOfficialLettersFromSupabase(),
      fetchOrganizationRecordsFromSupabase(),
      fetchChequesFromSupabase(),
    ]);

    const refreshedUsers = await fetchUsersFromSupabase();
    const refreshedDropdowns = await fetchDropdownsFromSupabase();
    const refreshedDynamicFields = await fetchDynamicFieldsFromSupabase();
    const settings = await fetchSystemSettingsFromSupabase();

    return {
      isSupabaseActive: true,
      restoredData: {
        citizens,
        requests,
        interviews,
        officialLetters,
        organizationRecords,
        cheques,
        users: refreshedUsers.length > 0 ? refreshedUsers : params.codeUsers,
        dropdowns: refreshedDropdowns.length > 0 ? refreshedDropdowns : params.codeDropdowns,
        dynamicFields: refreshedDynamicFields.length > 0 ? refreshedDynamicFields : params.codeDynamicFields,
        settings,
      },
      newItemsAddedToSupabase: {
        usersCount: newUsersAdded,
        dropdownsCount: newDropdownsAdded,
        dynamicFieldsCount: newFieldsAdded,
      },
      message: `تم التحقق والمزامنة بنجاح: تم حفظ البيانات الجديدة تلقائياً واسترجاع ${citizens.length} مواطن و${requests.length} معاملة من قاعدة البيانات.`,
    };
  } catch (err: any) {
    console.error('Error during autoSyncNewCodeDataToSupabase:', err);
    return {
      isSupabaseActive: false,
      newItemsAddedToSupabase: { usersCount: 0, dropdownsCount: 0, dynamicFieldsCount: 0 },
      message: `حدث خطأ أثناء المزامنة التلقائية: ${err?.message || err}`,
    };
  }
}

// -------------------------------------------------------------
// Comprehensive Two-Way Synchronization
// -------------------------------------------------------------

export interface SyncProgressCallback {
  (step: number, total: number, message: string): void;
}

export async function syncAllLocalDataToSupabase(
  data: {
    citizens: Citizen[];
    requests: OfficeRequest[];
    interviews: Interview[];
    officialLetters: OfficialLetter[];
    organizationRecords: OrganizationRecord[];
    cheques: ChequeRecord[];
    auditLogs: AuditLog[];
    users: User[];
    settings?: SystemSettings;
  },
  onProgress?: SyncProgressCallback
): Promise<{ success: boolean; message: string; counts: Record<string, number> }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'قاعدة بيانات Supabase غير متصلة. يرجى ضبط الرابط والمفتاح أولاً.',
      counts: {},
    };
  }

  const counts: Record<string, number> = {
    citizens: 0,
    requests: 0,
    interviews: 0,
    letters: 0,
    org: 0,
    cheques: 0,
    logs: 0,
    users: 0,
  };

  const totalSteps = 9;
  let currentStep = 0;

  // Step 1: Citizens
  currentStep++;
  onProgress?.(currentStep, totalSteps, `جاري حفظ المواطنين في Supabase (${data.citizens.length} سجل)...`);
  for (const c of data.citizens) {
    const ok = await upsertCitizenToSupabase(c);
    if (ok) counts.citizens++;
  }

  // Step 2: Requests
  currentStep++;
  onProgress?.(currentStep, totalSteps, `جاري حفظ المعاملات والطلبات (${data.requests.length} طلب)...`);
  for (const r of data.requests) {
    const ok = await upsertRequestToSupabase(r);
    if (ok) counts.requests++;
  }

  // Step 3: Interviews
  currentStep++;
  onProgress?.(currentStep, totalSteps, `جاري حفظ المقابلات (${data.interviews.length} مقابلة)...`);
  for (const i of data.interviews) {
    const ok = await upsertInterviewToSupabase(i);
    if (ok) counts.interviews++;
  }

  // Step 4: Official Letters
  currentStep++;
  onProgress?.(currentStep, totalSteps, `جاري حفظ الكتب الرسمية (${data.officialLetters.length} كتاب)...`);
  for (const l of data.officialLetters) {
    const ok = await upsertOfficialLetterToSupabase(l);
    if (ok) counts.letters++;
  }

  // Step 5: Organization Records
  currentStep++;
  onProgress?.(currentStep, totalSteps, `جاري حفظ السجل التنظيمي (${data.organizationRecords.length} سجل)...`);
  for (const o of data.organizationRecords) {
    const ok = await upsertOrganizationRecordToSupabase(o);
    if (ok) counts.org++;
  }

  // Step 6: Cheques
  currentStep++;
  onProgress?.(currentStep, totalSteps, `جاري حفظ الصكوك المالية (${data.cheques.length} صك)...`);
  for (const ch of data.cheques) {
    const ok = await upsertChequeToSupabase(ch);
    if (ok) counts.cheques++;
  }

  // Step 7: Audit Logs (last 50)
  currentStep++;
  onProgress?.(currentStep, totalSteps, `جاري حفظ سجلات الأمان والتدقيق...`);
  for (const log of data.auditLogs.slice(0, 50)) {
    const ok = await insertAuditLogToSupabase(log);
    if (ok) counts.logs++;
  }

  // Step 8: Users
  currentStep++;
  onProgress?.(currentStep, totalSteps, `جاري حفظ حسابات الموظفين...`);
  for (const u of data.users) {
    const ok = await upsertUserToSupabase(u);
    if (ok) counts.users++;
  }

  // Step 9: Settings
  currentStep++;
  if (data.settings) {
    onProgress?.(currentStep, totalSteps, `جاري حفظ إعدادات النظام...`);
    await saveSystemSettingsToSupabase(data.settings);
  }

  return {
    success: true,
    message: `تم حفظ ومزامنة كافة السجلات بنجاح في قاعدة بيانات Supabase (${counts.citizens} مواطن، ${counts.requests} معاملة، ${counts.cheques} صك).`,
    counts,
  };
}

/**
 * Fetch all records across all tables from Supabase to completely restore or update local state.
 */
export async function fetchAllDataFromSupabase(): Promise<{
  success: boolean;
  message: string;
  data: {
    citizens: Citizen[];
    requests: OfficeRequest[];
    interviews: Interview[];
    officialLetters: OfficialLetter[];
    organizationRecords: OrganizationRecord[];
    cheques: ChequeRecord[];
    auditLogs: AuditLog[];
    users: User[];
    settings: Partial<SystemSettings> | null;
  };
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'قاعدة بيانات Supabase غير متصلة.',
      data: {
        citizens: [],
        requests: [],
        interviews: [],
        officialLetters: [],
        organizationRecords: [],
        cheques: [],
        auditLogs: [],
        users: [],
        settings: null,
      },
    };
  }

  try {
    const [
      citizens,
      requests,
      interviews,
      officialLetters,
      organizationRecords,
      cheques,
      auditLogs,
      users,
      settings,
    ] = await Promise.all([
      fetchCitizensFromSupabase(),
      fetchRequestsFromSupabase(),
      fetchInterviewsFromSupabase(),
      fetchOfficialLettersFromSupabase(),
      fetchOrganizationRecordsFromSupabase(),
      fetchChequesFromSupabase(),
      fetchAuditLogsFromSupabase(),
      fetchUsersFromSupabase(),
      fetchSystemSettingsFromSupabase(),
    ]);

    return {
      success: true,
      message: `تم جلب البيانات بنجاح: ${citizens.length} مواطن، ${requests.length} معاملة، ${cheques.length} صك.`,
      data: {
        citizens,
        requests,
        interviews,
        officialLetters,
        organizationRecords,
        cheques,
        auditLogs,
        users,
        settings,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `تعذر جلب البيانات: ${err?.message || 'خطأ غير متوقع'}`,
      data: {
        citizens: [],
        requests: [],
        interviews: [],
        officialLetters: [],
        organizationRecords: [],
        cheques: [],
        auditLogs: [],
        users: [],
        settings: null,
      },
    };
  }
}

/**
 * Real-time channel listener for live synchronization across users.
 */
export function subscribeToSupabaseChanges(
  onTableChange: (tableName: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', newRecord: any, oldRecord: any) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};

  const channel = client
    .channel('office_supabase_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      (payload) => {
        onTableChange(payload.table, payload.eventType as any, payload.new, payload.old);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
