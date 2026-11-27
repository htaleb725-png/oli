import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { Citizen, OfficeRequest, Interview, OrganizationRecord } from '../types';
import { printElementIsolated } from '../utils/printReceiptHelper';
import {
  X,
  Clock,
  Award,
  Printer,
  FileSpreadsheet,
  FileText,
  Phone,
  MapPin,
  UserCheck,
  Briefcase,
  ShieldAlert,
  Calendar,
  Hash,
  Building2,
  CheckCircle2,
  Filter
} from 'lucide-react';

type TimelineFilter = 'all' | 'requests' | 'visits_notes';

type ActivityCategory =
  | 'request'
  | 'org_referral'
  | 'registration'
  | 'status_update'
  | 'interview'
  | 'document';

interface TimelineEntry {
  id: string;
  rawDate: string;
  timestamp: number;
  title: string;
  category: ActivityCategory;
  badgeLabel: string;
  badgeCls: string;
  details: string;
  actor?: string;
  metaLine?: string;
}

const normalizeDigits = (val?: string): string =>
  String(val || '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

const normalizePhone = (val?: string): string => normalizeDigits(val).replace(/\D/g, '');

const normalizeArabicName = (val?: string): string =>
  String(val || '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();

const parseSafeTimestamp = (raw?: string): number => {
  const s = normalizeDigits(raw).trim();
  if (!s) return 0;
  let ts = Date.parse(s);
  if (Number.isNaN(ts) && /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(s)) {
    ts = Date.parse(s.replace(/\s+/, 'T'));
  }
  if (Number.isNaN(ts)) {
    const slashMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (slashMatch) {
      const [, d, m, y] = slashMatch;
      ts = Date.parse(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    }
  }
  return Number.isNaN(ts) ? 0 : ts;
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Formats ISO / database timestamps into crisp readable Arabic administrative date & time.
 * Never exposes raw ISO strings (e.g. 2026-11-27T14:20:00.000Z).
 */
const formatReadableDateTime = (raw?: string, includeTime = true): string => {
  const cleaned = normalizeDigits(raw).trim();
  if (!cleaned) return 'غير محدد';

  // Pure YYYY-MM-DD (no time component)
  const dateOnlyMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    return `${y}/${m}/${d}`;
  }

  const ts = parseSafeTimestamp(cleaned);
  if (!ts) return cleaned;

  const dt = new Date(ts);
  const datePart = `${dt.getFullYear()}/${pad2(dt.getMonth() + 1)}/${pad2(dt.getDate())}`;

  const hasTimeToken = /T\d{2}:\d{2}|\s\d{1,2}:\d{2}/.test(cleaned);
  if (!includeTime || !hasTimeToken) {
    return datePart;
  }

  const hours24 = dt.getHours();
  const minutes = pad2(dt.getMinutes());
  const period = hours24 >= 12 ? 'م' : 'ص';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${datePart} · ${pad2(hours12)}:${minutes} ${period}`;
};

const formatNowForPrint = (): string => {
  const now = new Date();
  const datePart = `${now.getFullYear()}/${pad2(now.getMonth() + 1)}/${pad2(now.getDate())}`;
  const hours24 = now.getHours();
  const minutes = pad2(now.getMinutes());
  const period = hours24 >= 12 ? 'م' : 'ص';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${datePart} — ${pad2(hours12)}:${minutes} ${period}`;
};

const getRequestStatusMeta = (req: OfficeRequest): { label: string; cls: string } => {
  const proc = String(req.ProcessingStatus || '').trim();
  const deliv = String(req.DeliveryStatus || req.RequestStatus || '').trim();
  if (proc === 'مرفوض' || req.DirectorDecision === 'رفض') {
    return {
      label: 'مرفوض',
      cls: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
    };
  }
  if (proc === 'منجز' || deliv === 'مستلم') {
    return {
      label: deliv === 'مستلم' ? 'منجز · مستلم' : 'منجز',
      cls: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    };
  }
  if (proc === 'قيد الإجراء' || proc === 'مرسل إلى الوزارة/الهيئة' || proc === 'تم الطباعة') {
    return {
      label: proc,
      cls: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    };
  }
  return {
    label: proc || 'قيد التدقيق',
    cls: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
  };
};

export const CitizenHistoryModal: React.FC = () => {
  const {
    selectedCitizenForHistory,
    setSelectedCitizenForHistory,
    citizens,
    requests,
    interviews,
    organizationRecords,
    documents,
    setPrintableCitizenCard,
    setPrintableBadgeCitizen,
    canPrintOfficialCard,
    currentUser,
    systemSettings,
    addAuditLog
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<TimelineFilter>('all');
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const printSheetRef = useRef<HTMLDivElement>(null);

  // Add body class while modal is open so browser Ctrl+P prints only the official A4 sheet
  useEffect(() => {
    if (!selectedCitizenForHistory) {
      document.body.classList.remove('citizen-history-open');
      return;
    }
    document.body.classList.add('citizen-history-open');
    setActiveFilter('all');
    return () => {
      document.body.classList.remove('citizen-history-open');
    };
  }, [selectedCitizenForHistory?.Citizen_ID]);

  // Always resolve freshest live citizen object from context
  const citizen: Citizen | null = useMemo(() => {
    if (!selectedCitizenForHistory) return null;
    const id = String(selectedCitizenForHistory.Citizen_ID || '').trim();
    const liveMatch = (citizens || []).find(c => String(c?.Citizen_ID || '').trim() === id);
    return liveMatch || selectedCitizenForHistory;
  }, [selectedCitizenForHistory, citizens]);

  // Accurately match and deduplicate submitted administrative/service requests for this citizen
  const citizenRequests: OfficeRequest[] = useMemo(() => {
    if (!citizen) return [];
    const targetId = String(citizen.Citizen_ID || '').trim();
    const targetName = normalizeArabicName(citizen.FullName);
    const targetPhone = normalizePhone(citizen.Phone1);

    const matchedMap = new Map<string, OfficeRequest>();

    (requests || []).forEach(r => {
      if (!r) return;
      const reqId = String(r.Request_ID || '').trim();
      if (!reqId || reqId.startsWith('[محذوف') || reqId.startsWith('[deleted')) return;

      const reqCitId = String(r.Citizen_ID || '').trim();
      const reqName = normalizeArabicName(r.CitizenName);
      const reqPhone = normalizePhone(r.CitizenPhone);

      const isIdMatch = Boolean(targetId && reqCitId && reqCitId === targetId);
      const isUnlinkedNameMatch = Boolean(!reqCitId && targetName && reqName === targetName);
      const isStrictNameAndPhoneMatch = Boolean(
        !isIdMatch &&
          targetName &&
          reqName === targetName &&
          targetPhone.length >= 9 &&
          reqPhone === targetPhone
      );

      if (!isIdMatch && !isUnlinkedNameMatch && !isStrictNameAndPhoneMatch) return;

      // Keep the most up-to-date record if a duplicate Request_ID appears
      const existing = matchedMap.get(reqId);
      if (!existing) {
        matchedMap.set(reqId, r);
      } else {
        const existingTs = parseSafeTimestamp(existing.UpdatedAt || existing.CreatedAt);
        const incomingTs = parseSafeTimestamp(r.UpdatedAt || r.CreatedAt);
        if (incomingTs >= existingTs) {
          matchedMap.set(reqId, r);
        }
      }
    });

    return Array.from(matchedMap.values()).sort(
      (a, b) =>
        parseSafeTimestamp(b.CreatedAt || b.CreatedDate || b.OutgoingDate || b.UpdatedAt) -
        parseSafeTimestamp(a.CreatedAt || a.CreatedDate || a.OutgoingDate || a.UpdatedAt)
    );
  }, [citizen, requests]);

  const requestBreakdown = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let rejected = 0;
    citizenRequests.forEach(r => {
      if (r.ProcessingStatus === 'مرفوض' || r.DirectorDecision === 'رفض') {
        rejected++;
      } else if (r.ProcessingStatus === 'منجز' || r.DeliveryStatus === 'مستلم' || r.RequestStatus === 'مستلم') {
        completed++;
      } else {
        inProgress++;
      }
    });
    return { completed, inProgress, rejected };
  }, [citizenRequests]);

  // Accurately match interviews
  const citizenInterviews: Interview[] = useMemo(() => {
    if (!citizen) return [];
    const targetId = String(citizen.Citizen_ID || '').trim();
    const map = new Map<string, Interview>();
    (interviews || []).forEach(i => {
      if (!i) return;
      const iId = String(i.Interview_ID || '').trim();
      if (!iId) return;
      if (String(i.Citizen_ID || '').trim() === targetId) {
        map.set(iId, i);
      }
    });
    return Array.from(map.values()).sort(
      (a, b) =>
        parseSafeTimestamp(`${b.InterviewDate} ${b.InterviewTime || ''}`) -
        parseSafeTimestamp(`${a.InterviewDate} ${a.InterviewTime || ''}`)
    );
  }, [citizen, interviews]);

  // Match Organization record
  const citizenOrg: OrganizationRecord | undefined = useMemo(() => {
    if (!citizen) return undefined;
    const targetId = String(citizen.Citizen_ID || '').trim();
    return (organizationRecords || []).find(o => String(o?.Citizen_ID || '').trim() === targetId);
  }, [citizen, organizationRecords]);

  // Accurately match archived documents (cloud documents + unique scanned request attachments)
  const { citizenDocs, requestScanAttachmentsCount } = useMemo(() => {
    if (!citizen) return { citizenDocs: [], requestScanAttachmentsCount: 0 };
    const targetId = String(citizen.Citizen_ID || '').trim();
    const docs = (documents || []).filter(d => String(d?.Citizen_ID || '').trim() === targetId);
    const uniqueScanUrls = new Set<string>();
    citizenRequests.forEach(r => {
      if (r.AttachedRequestImage) uniqueScanUrls.add(r.AttachedRequestImage);
      if (r.AttachmentRequest) uniqueScanUrls.add(r.AttachmentRequest);
      if (r.AttachmentResponse) uniqueScanUrls.add(r.AttachmentResponse);
      (r.ScanAttachments || []).forEach(att => {
        if (att?.url) uniqueScanUrls.add(att.url);
      });
    });
    return {
      citizenDocs: docs,
      requestScanAttachmentsCount: uniqueScanUrls.size
    };
  }, [citizen, documents, citizenRequests]);

  const totalArchivedDocsCount = citizenDocs.length + requestScanAttachmentsCount;

  // Build rich, structured chronological timeline
  const timelineItems: TimelineEntry[] = useMemo(() => {
    if (!citizen) return [];
    const items: TimelineEntry[] = [];
    const seenIds = new Set<string>();

    const pushEntry = (entry: TimelineEntry) => {
      if (seenIds.has(entry.id)) return;
      seenIds.add(entry.id);
      items.push(entry);
    };

    // 1. Initial Registration
    const addressParts = [citizen.District, citizen.SubDistrict, citizen.ResidentialArea].filter(Boolean);
    pushEntry({
      id: `init-reg-${citizen.Citizen_ID}`,
      rawDate: citizen.CreatedAt || '',
      timestamp: parseSafeTimestamp(citizen.CreatedAt),
      title: 'تسجيل المراجع لأول مرة في المنظومة',
      category: 'registration',
      badgeLabel: 'تسجيل مبدئي',
      badgeCls: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      details: `تم إنشاء الملف التعريفي (${citizen.Citizen_ID}). السكن: ${addressParts.join(' — ') || 'غير محدد'}. التقييم الأولي: ${citizen.Rating || 'لائق'}${citizen.ReferralSource ? ` · المعرّف: ${citizen.ReferralSource}` : ''}.`,
      actor: citizen.CreatedBy || 'قسم الاستعلامات'
    });

    // 2. Submitted Requests + Referral + Director Decision + Delivery + Workflow Actions
    citizenRequests.forEach(r => {
      const outgoingPart = r.OutgoingNumber
        ? `العدد الصادر: ${r.OutgoingNumber}${r.OutgoingDate ? ` بتاريخ ${formatReadableDateTime(r.OutgoingDate, false)}` : ''}`
        : '';
      const statusParts = [
        `الحالة: ${r.ProcessingStatus || 'قيد التدقيق'}`,
        r.CurrentStage ? `المرحلة: ${r.CurrentStage}` : '',
        r.DeliveryStatus ? `الاستلام: ${r.DeliveryStatus}` : '',
        outgoingPart
      ].filter(Boolean);

      const noteParts = [
        r.Details ? r.Details : '',
        r.DeputyNotes ? `توجيه النائب: ${r.DeputyNotes}` : '',
        r.DirectorNotes ? `ملاحظات المدير: ${r.DirectorNotes}` : '',
        r.ReceptionNotes ? `ملاحظات الاستعلامات: ${r.ReceptionNotes}` : ''
      ].filter(Boolean);

      pushEntry({
        id: `req-${r.Request_ID}`,
        rawDate: r.CreatedAt || r.CreatedDate || '',
        timestamp: parseSafeTimestamp(r.CreatedAt || r.CreatedDate),
        title: `تقديم طلب إداري إلى [${r.Entity || 'جهة حكومية'}] — رقم ${r.Request_ID}`,
        category: 'request',
        badgeLabel: 'تقديم طلب',
        badgeCls: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        details: noteParts.join(' — ') || 'طلب إداري وخدمي مسجل في قاعدة البيانات.',
        actor: r.CreatedBy || 'قسم الإدارة',
        metaLine: statusParts.join(' · ')
      });

      // Director Decision milestone
      if (r.DirectorDecision && r.DirectorDecisionDate) {
        pushEntry({
          id: `req-dir-${r.Request_ID}`,
          rawDate: r.DirectorDecisionDate,
          timestamp: parseSafeTimestamp(r.DirectorDecisionDate),
          title: `تحديث قرار الإدارة التنفيذية للطلب (${r.Request_ID}): ${r.DirectorDecision}`,
          category: 'status_update',
          badgeLabel: 'تحديث حالة',
          badgeCls: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          details:
            r.DirectorDecision === 'رفض' && r.RejectionReason
              ? `سبب الرفض: ${r.RejectionReason}${r.DirectorNotes ? ` — ${r.DirectorNotes}` : ''}`
              : r.DirectorNotes || `تم توجيه المعاملة بمسار (${r.DirectorDecision}).`,
          actor: r.DirectorDecisionBy || 'مدير المكتب'
        });
      }

      // Delivery milestone
      if (r.DeliveredAt) {
        pushEntry({
          id: `req-deliv-${r.Request_ID}`,
          rawDate: r.DeliveredAt,
          timestamp: parseSafeTimestamp(r.DeliveredAt),
          title: `توثيق استلام الطلب (${r.Request_ID}) من قِبل المراجع`,
          category: 'status_update',
          badgeLabel: 'تحديث حالة',
          badgeCls: 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
          details: `تم تسليم المعاملة إلى المراجع وتحديث حالة الاستلام إلى «مستلم»${outgoingPart ? ` (${outgoingPart})` : ''}.`,
          actor: r.DeliveredBy || 'قسم الإدارة'
        });
      }

      // Organization Referral milestone
      if (r.referredToOrganization || r.ReferredToOrganizationAt) {
        const refDate = r.ReferredToOrganizationAt || r.UpdatedAt || r.CreatedAt || '';
        pushEntry({
          id: `req-orgref-${r.Request_ID}`,
          rawDate: refDate,
          timestamp: parseSafeTimestamp(refDate),
          title: `إحالة ملف الطلب (${r.Request_ID}) إلى قسم التنظيم والجماهير`,
          category: 'org_referral',
          badgeLabel: 'إحالة للتنظيم',
          badgeCls: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
          details: `تم تحويل الطلب الخاص بـ (${r.Entity || 'الجهة المعنية'}) للمتابعة التنظيمية الميدانية وتثبيت الموقف النهائي.`,
          actor: r.ReferredToOrganizationBy || 'قسم الإدارة'
        });
      }

      // Request Workflow History entries
      (r.WorkflowHistory || []).forEach((wf, idx) => {
        const wfDate = wf.actionDate || wf.Timestamp || '';
        const fromSt = wf.fromStage || wf.FromStage || '';
        const toSt = wf.toStage || wf.ToStage || '';
        const wfNote = wf.directiveNote || wf.DirectiveNotes || wf.statusText || '';
        if (!toSt && !wfNote) return;
        const isOrgTarget = String(toSt).includes('تنظيم');
        pushEntry({
          id: `req-wf-${r.Request_ID}-${wf.id || idx}`,
          rawDate: wfDate,
          timestamp: parseSafeTimestamp(wfDate),
          title: fromSt && toSt ? `تحويل مسار (${r.Request_ID}): ${fromSt} ← ${toSt}` : `تحديث مسار الطلب (${r.Request_ID})`,
          category: isOrgTarget ? 'org_referral' : 'status_update',
          badgeLabel: isOrgTarget ? 'إحالة للتنظيم' : 'تحديث حالة',
          badgeCls: isOrgTarget
            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          details: wfNote || `تم تحديث المرحلة الإدارية للطلب إلى (${toSt}).`,
          actor: wf.fromUser || wf.ActionBy || 'الإدارة'
        });
      });
    });

    // 3. Citizen-level referral to organization (when no request-level referral existed)
    if (citizen.referredToOrganization && citizen.ReferredToOrganizationAt) {
      const alreadyHasReqRef = items.some(it => it.category === 'org_referral');
      if (!alreadyHasReqRef) {
        pushEntry({
          id: `cit-orgref-${citizen.Citizen_ID}`,
          rawDate: citizen.ReferredToOrganizationAt,
          timestamp: parseSafeTimestamp(citizen.ReferredToOrganizationAt),
          title: 'إحالة ملف المراجع إلى قسم التنظيم والجماهير',
          category: 'org_referral',
          badgeLabel: 'إحالة للتنظيم',
          badgeCls: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
          details: 'تمت إحالة المراجع لمتابعة الموقف التنظيمي والاتصال الجماهيري.',
          actor: citizen.ReferredToOrganizationBy || 'قسم الإدارة'
        });
      }
    }

    // 4. Organization Final Evaluation & Notes
    if (citizenOrg?.finalEvaluation?.finalResult) {
      const ev = citizenOrg.finalEvaluation;
      const officerNotes =
        ev.case1_officerNotes ||
        ev.case2_officerNotes ||
        ev.case3_officerNotes ||
        ev.case4_officerNotes ||
        ev.case4_specialNote ||
        citizenOrg.Notes ||
        '';
      const evalDetailParts = [
        `النتيجة المعتمدة: ${ev.finalResult}`,
        citizenOrg.OrgRating ? `الموقف التنظيمي: ${citizenOrg.OrgRating}` : '',
        citizenOrg.isTeamMember ? `انضمام لفريق العمل (${citizenOrg.teamMemberRole || ev.case3_teamRole || 'مفتاح نهائي'})` : '',
        officerNotes ? `الملاحظات: ${officerNotes}` : ''
      ].filter(Boolean);

      pushEntry({
        id: `org-eval-${citizen.Citizen_ID}-${ev.evaluatedAt || 'latest'}`,
        rawDate: ev.evaluatedAt || citizenOrg.UpdatedAt || '',
        timestamp: parseSafeTimestamp(ev.evaluatedAt || citizenOrg.UpdatedAt),
        title: `تثبيت التقييم التنظيمي النهائي — ${ev.finalResult}`,
        category: 'status_update',
        badgeLabel: 'تحديث حالة',
        badgeCls: 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        details: evalDetailParts.join(' · '),
        actor: ev.evaluatedBy || 'المكتب التنظيمي'
      });
    } else if (citizenOrg && (citizenOrg.Notes || citizenOrg.OrgRating)) {
      pushEntry({
        id: `org-rec-${citizen.Citizen_ID}`,
        rawDate: citizenOrg.UpdatedAt || '',
        timestamp: parseSafeTimestamp(citizenOrg.UpdatedAt),
        title: `تحديث بيانات الموقف التنظيمي (${citizenOrg.OrgRating || 'مسجل'})`,
        category: 'status_update',
        badgeLabel: 'تحديث حالة',
        badgeCls: 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        details: [
          citizenOrg.InfluenceType ? `الصفة الاجتماعية: ${citizenOrg.InfluenceType}` : '',
          citizenOrg.ElectionCenter ? `المركز الانتخابي: ${citizenOrg.ElectionCenter}` : '',
          citizenOrg.Notes ? `ملاحظات: ${citizenOrg.Notes}` : ''
        ]
          .filter(Boolean)
          .join(' · ') || 'تم توثيق الملف ضمن سجلات المكتب التنظيمي.',
        actor: 'المكتب التنظيمي'
      });
    }

    // 5. Parliamentary Interviews
    citizenInterviews.forEach(i => {
      const dateStr = [i.InterviewDate, i.InterviewTime].filter(Boolean).join(' ');
      pushEntry({
        id: `int-${i.Interview_ID}`,
        rawDate: dateStr || i.CreatedAt || '',
        timestamp: parseSafeTimestamp(dateStr || i.CreatedAt),
        title: `مقابلة برلمانية — ${i.Subject || 'لقاء مباشر'}`,
        category: 'interview',
        badgeLabel: 'مقابلة برلمانية',
        badgeCls: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        details: [
          `الحالة: ${i.Status || 'مجدولة'}`,
          i.DeputyNotes ? `توجيه النائب: ${i.DeputyNotes}` : '',
          i.Outcome ? `النتيجة: ${i.Outcome}` : ''
        ]
          .filter(Boolean)
          .join(' · '),
        actor: 'قسم المقابلات'
      });
    });

    // 6. Archived Documents
    citizenDocs.forEach(d => {
      pushEntry({
        id: `doc-${d.Doc_ID}`,
        rawDate: d.UploadedAt || '',
        timestamp: parseSafeTimestamp(d.UploadedAt),
        title: `أرشفة وثيقة رسمية: ${d.Title}`,
        category: 'document',
        badgeLabel: 'أرشفة وثيقة',
        badgeCls: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        details: `التصنيف: ${d.Category || 'مستند رسمي'}${d.FileSize ? ` · الحجم: ${d.FileSize}` : ''}.`,
        actor: d.UploadedBy || 'قسم الأرشفة'
      });
    });

    items.sort((a, b) => b.timestamp - a.timestamp);
    return items;
  }, [citizen, citizenRequests, citizenInterviews, citizenOrg, citizenDocs]);

  const filterCounts = useMemo(() => {
    const requestsOnly = timelineItems.filter(i => i.category === 'request').length;
    const visitsAndNotes = timelineItems.filter(i => i.category !== 'request').length;
    return {
      all: timelineItems.length,
      requests: requestsOnly,
      visits_notes: visitsAndNotes
    };
  }, [timelineItems]);

  const filteredTimeline = useMemo(() => {
    if (activeFilter === 'requests') {
      return timelineItems.filter(i => i.category === 'request');
    }
    if (activeFilter === 'visits_notes') {
      return timelineItems.filter(i => i.category !== 'request');
    }
    return timelineItems;
  }, [timelineItems, activeFilter]);

  if (!citizen) return null;

  const fullAddress =
    [citizen.District, citizen.SubDistrict, citizen.ResidentialArea].filter(Boolean).join(' · ') || 'غير مسجل';
  const printDateTime = formatNowForPrint();
  const emblemSrc = systemSettings?.parliamentEmblemUrl || systemSettings?.logoUrl || '/office-logo.png';

  const handlePrintOfficialOrgRecord = () => {
    addAuditLog(
      'طباعة السجل التنظيمي الرسمي',
      'قسم التنظيم والجماهير',
      `تمت طباعة السجل التنظيمي الرسمي (A4) للمراجع ${citizen.FullName} (${citizen.Citizen_ID}) — عدد الطلبات المقدمة: ${citizenRequests.length}`
    );

    if (printSheetRef.current) {
      printElementIsolated(printSheetRef.current, {
        title: `السجل التنظيمي الرسمي — ${citizen.FullName} (${citizen.Citizen_ID})`
      });
    } else {
      window.print();
    }
  };

  const handleExportRecordExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const profileSheet = XLSX.utils.json_to_sheet([
        {
          'الرقم التعريفي': citizen.Citizen_ID,
          'الاسم الكامل': citizen.FullName,
          'رقم الهاتف': citizen.Phone1 || '—',
          'الهاتف البديل': citizen.Phone2 || '—',
          'العنوان والسكن': fullAddress,
          'المعرّف / التزكية': citizen.ReferralSource || '—',
          'المهنة': citizen.Job || '—',
          'التحصيل الدراسي': citizen.Education || '—',
          'عدد الطلبات المقدمة': citizenRequests.length,
          'المقابلات البرلمانية': citizenInterviews.length,
          'الوثائق المؤرشفة': totalArchivedDocsCount,
          'الموقف التنظيمي': citizenOrg?.OrgRating || 'غير محدد',
          'نتيجة التقييم التنظيمي': citizenOrg?.finalEvaluation?.finalResult || 'بانتظار التقييم',
          'تاريخ التسجيل': formatReadableDateTime(citizen.CreatedAt),
          'تاريخ التصدير': printDateTime
        }
      ]);
      profileSheet['!views'] = [{ rightToLeft: true }];
      XLSX.utils.book_append_sheet(wb, profileSheet, 'بيانات المراجع');

      const requestsRows =
        citizenRequests.length > 0
          ? citizenRequests.map((r, idx) => ({
              'ت': idx + 1,
              'رقم الطلب': r.Request_ID,
              'الجهة المستهدفة': r.Entity || '—',
              'الموضوع والتفاصيل': r.Details || '—',
              'رقم الصادر': r.OutgoingNumber || '—',
              'تاريخ الصادر': r.OutgoingDate ? formatReadableDateTime(r.OutgoingDate, false) : '—',
              'حالة الإنجاز': r.ProcessingStatus || 'قيد التدقيق',
              'المرحلة الحالية': r.CurrentStage || '—',
              'حالة الاستلام': r.DeliveryStatus || r.RequestStatus || '—',
              'الأولوية': r.Priority || 'عام',
              'تاريخ التقديم': formatReadableDateTime(r.CreatedAt || r.CreatedDate)
            }))
          : [{ 'ملاحظة': 'لا توجد طلبات مسجلة لهذا المراجع' }];

      const reqSheet = XLSX.utils.json_to_sheet(requestsRows);
      reqSheet['!views'] = [{ rightToLeft: true }];
      XLSX.utils.book_append_sheet(wb, reqSheet, 'الطلبات المقدمة');

      const timelineRows = timelineItems.map((it, idx) => ({
        'ت': idx + 1,
        'التاريخ والوقت': formatReadableDateTime(it.rawDate),
        'نوع النشاط': it.badgeLabel,
        'العنوان': it.title,
        'التفاصيل': it.details,
        'المسؤول / الجهة': it.actor || '—'
      }));
      const tlSheet = XLSX.utils.json_to_sheet(timelineRows);
      tlSheet['!views'] = [{ rightToLeft: true }];
      XLSX.utils.book_append_sheet(wb, tlSheet, 'التسلسل الزمني');

      const safeFileName = `سجل_تنظيمي_${citizen.FullName.replace(/\s+/g, '_')}_${citizen.Citizen_ID}.xlsx`;
      XLSX.writeFile(wb, safeFileName);

      addAuditLog(
        'تصدير السجل التنظيمي',
        'قسم التنظيم والجماهير',
        `تم تصدير سجل المراجع ${citizen.FullName} (${citizen.Citizen_ID}) إلى ملف Excel`
      );
      setExportNotice('تم تصدير ملف السجل بنجاح');
      window.setTimeout(() => setExportNotice(null), 3500);
    } catch (err) {
      console.error('Export citizen history excel failed:', err);
      setExportNotice('تعذر تصدير الملف حالياً');
      window.setTimeout(() => setExportNotice(null), 3500);
    }
  };

  return (
    <>
      {/* ================================================================== */}
      {/* INTERACTIVE INSTITUTIONAL MODAL (Hidden on Print)                  */}
      {/* ================================================================== */}
      <div
        className="no-print fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`السجل التنظيمي للمراجع ${citizen.FullName}`}
      >
        <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
          {/* 1. Institutional Official Dossier Header */}
          <div className="bg-slate-900 text-white px-5 py-4 border-b border-slate-800">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Citizen Identity Block */}
              <div className="min-w-0 text-right space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-amber-300">
                  <span>مكتب النائب علا الناشي — المكتب التنظيمي</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-300">بطاقة الملف التنظيمي والسجل الشامل</span>
                </div>

                <div className="flex flex-wrap items-baseline gap-2.5">
                  <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    {citizen.FullName}
                  </h3>
                  <span className="font-mono text-xs font-bold text-slate-300 tabular-nums" dir="ltr">
                    #{citizen.Citizen_ID}
                  </span>
                  {citizen.IsBlocked && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/40 text-rose-200 text-[11px] font-bold">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>محظور في القائمة السوداء</span>
                    </span>
                  )}
                </div>

                {/* Clean Unboxed Metadata Row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono tabular-nums" dir="ltr">
                      {citizen.Phone1 || 'غير مسجل'}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{fullAddress}</span>
                  </span>
                  {citizen.ReferralSource && (
                    <>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="inline-flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>المعرّف: {citizen.ReferralSource}</span>
                      </span>
                    </>
                  )}
                  {(citizen.Job || citizen.Education) && (
                    <>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{[citizen.Job, citizen.Education].filter(Boolean).join(' / ')}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Single-Line Institutional Action Controls */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrintOfficialOrgRecord}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  title="طباعة وثيقة السجل التنظيمي الرسمية (A4)"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>طباعة رسمية (A4)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportRecordExcel}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  title="تصدير السجل الكامل إلى ملف Excel"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span>تصدير Excel</span>
                </button>

                {canPrintOfficialCard(currentUser) && (
                  <button
                    type="button"
                    onClick={() => setPrintableCitizenCard(citizen)}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Award className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>بطاقة المعلومات</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPrintableBadgeCitizen(citizen)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  وصل مراجعة
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCitizenForHistory(null)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer shrink-0"
                  aria-label="إغلاق نافذة السجل"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {exportNotice && (
              <div className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{exportNotice}</span>
              </div>
            )}
          </div>

          {/* 2. Scrollable Workspace Body */}
          <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/70 dark:bg-slate-950/60">
            {/* KPI Summary Row — Clear Separation of Actual Submitted Requests & Institutional Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-right">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>الطلبات المقدمة</span>
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-3xl font-black text-blue-700 dark:text-blue-400 mt-1.5 tabular-nums">
                  {citizenRequests.length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  {citizenRequests.length > 0
                    ? `منجز: ${requestBreakdown.completed} · قيد المتابعة: ${requestBreakdown.inProgress}${requestBreakdown.rejected > 0 ? ` · مرفوض: ${requestBreakdown.rejected}` : ''}`
                    : 'لا توجد طلبات مسجلة'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-right">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>المقابلات البرلمانية</span>
                  <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1.5 tabular-nums">
                  {citizenInterviews.length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {citizenInterviews.length > 0 ? 'مقابلات ومواعيد مسجلة' : 'لا توجد مقابلات مسجلة'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-right">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>الوثائق المؤرشفة</span>
                  <Hash className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-3xl font-black text-purple-700 dark:text-purple-400 mt-1.5 tabular-nums">
                  {totalArchivedDocsCount}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  {totalArchivedDocsCount > 0
                    ? `مستندات: ${citizenDocs.length} · مرفقات: ${requestScanAttachmentsCount}`
                    : 'لا توجد وثائق مرفقة'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-right">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>الموقف التنظيمي</span>
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-2 truncate">
                  {citizenOrg?.OrgRating || 'غير محدد'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {citizenOrg?.finalEvaluation?.finalResult ||
                    (citizenOrg?.isTeamMember
                      ? `عضو فريق: ${citizenOrg.teamMemberRole || 'مفتاح نهائي'}`
                      : 'بانتظار التقييم التنظيمي')}
                </div>
              </div>
            </div>

            {/* Section A: Structured Quick Summary of Submitted Requests */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="text-right">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    ملخص الطلبات المقدمة
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    كشف تفصيلي بكافة الطلبات الإدارية والخدمية المرتبطة بملف المراجع
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                  الإجمالي: {citizenRequests.length} {citizenRequests.length === 1 ? 'طلب' : 'طلبات'}
                </span>
              </div>

              {citizenRequests.length === 0 ? (
                <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                  لا توجد طلبات إدارية أو خدمية مسجلة باسم هذا المراجع حتى الآن.
                </div>
              ) : (
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                          <th className="py-2.5 px-3 font-extrabold whitespace-nowrap">رقم الطلب</th>
                          <th className="py-2.5 px-3 font-extrabold">الجهة المستهدفة والموضوع</th>
                          <th className="py-2.5 px-3 font-extrabold whitespace-nowrap">رقم الصادر والتاريخ</th>
                          <th className="py-2.5 px-3 font-extrabold whitespace-nowrap">الحالة / المرحلة الحالية</th>
                          <th className="py-2.5 px-3 font-extrabold whitespace-nowrap">تاريخ التقديم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {citizenRequests.map(req => {
                          const st = getRequestStatusMeta(req);
                          return (
                            <tr
                              key={req.Request_ID}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-3 px-3 align-top whitespace-nowrap">
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums" dir="ltr">
                                  {req.Request_ID}
                                </span>
                                {req.Priority && req.Priority !== 'عام' && (
                                  <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                                    أولوية: {req.Priority}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 align-top max-w-xs">
                                <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{req.Entity || 'جهة حكومية غير محددة'}</span>
                                </div>
                                {req.Details && (
                                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                                    {req.Details}
                                  </p>
                                )}
                              </td>
                              <td className="py-3 px-3 align-top whitespace-nowrap">
                                {req.OutgoingNumber ? (
                                  <div className="space-y-0.5 tabular-nums">
                                    <div className="font-mono font-extrabold text-slate-900 dark:text-slate-100">
                                      العدد: {req.OutgoingNumber}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {req.OutgoingDate ? formatReadableDateTime(req.OutgoingDate, false) : 'بدون تاريخ'}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500">—</span>
                                )}
                              </td>
                              <td className="py-3 px-3 align-top whitespace-nowrap">
                                <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-bold ${st.cls}`}>
                                  {st.label}
                                </span>
                                {req.CurrentStage && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                    المرحلة: {req.CurrentStage}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 align-top whitespace-nowrap text-slate-600 dark:text-slate-300 tabular-nums">
                                {formatReadableDateTime(req.CreatedAt || req.CreatedDate)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* Section B: Chronological Timeline with Quick Filter Controls */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="text-right">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    التسلسل الزمني للنشاطات والمراجعات
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    توثيق زمني كامل لحركة الطلبات، الإحالات التنظيمية، الملاحظات، وتحديثات الحالة
                  </p>
                </div>

                {/* Quick Filter Segmented Controls */}
                <div
                  className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 self-start sm:self-auto"
                  role="tablist"
                  aria-label="تصفية التسلسل الزمني"
                >
                  <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 mr-1.5 ml-0.5 shrink-0" />
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeFilter === 'all'}
                    onClick={() => setActiveFilter('all')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                      activeFilter === 'all'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    الكل ({filterCounts.all})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeFilter === 'requests'}
                    onClick={() => setActiveFilter('requests')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                      activeFilter === 'requests'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    الطلبات فقط ({filterCounts.requests})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeFilter === 'visits_notes'}
                    onClick={() => setActiveFilter('visits_notes')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                      activeFilter === 'visits_notes'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    المراجعات والملاحظات ({filterCounts.visits_notes})
                  </button>
                </div>
              </div>

              {filteredTimeline.length === 0 ? (
                <div className="p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    لا توجد نشاطات مطابقة للتصفية المحددة حالياً.
                  </p>
                  {activeFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setActiveFilter('all')}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                    >
                      عرض السجل الكامل
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative border-r border-slate-200 dark:border-slate-700 pr-5 mr-2.5 space-y-3">
                  {filteredTimeline.map(item => (
                    <div key={item.id} className="relative text-right">
                      {/* Crisp Timeline Node */}
                      <span
                        aria-hidden="true"
                        className="absolute -right-[25px] top-4 w-2.5 h-2.5 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-500 dark:border-slate-400"
                      />

                      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold whitespace-nowrap ${item.badgeCls}`}>
                              {item.badgeLabel}
                            </span>
                            <h5 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                              {item.title}
                            </h5>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{formatReadableDateTime(item.rawDate)}</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {item.details}
                        </p>

                        {(item.metaLine || item.actor) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                            {item.actor && <span>المسؤول: {item.actor}</span>}
                            {item.actor && item.metaLine && <span aria-hidden="true">·</span>}
                            {item.metaLine && <span className="tabular-nums">{item.metaLine}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* OFFICIAL A4 PRINTABLE DOCUMENT (مكتب النائب علا الناشي — المكتب التنظيمي) */}
      {/* ================================================================== */}
      <div
        ref={printSheetRef}
        className="org-history-print-sheet print-only print-preserve-light bg-white text-slate-900 text-right"
        dir="rtl"
      >
        <div className="border-2 border-slate-900 p-5 space-y-5 bg-white text-slate-900">
          {/* Official Top Letterhead */}
          <div className="flex items-center justify-between gap-4 pb-4 border-b-2 border-slate-900">
            <div className="space-y-0.5 text-right">
              <div className="text-sm font-black text-slate-950">جمهورية العراق</div>
              <div className="text-xs font-bold text-slate-700">مجلس النواب العراقي</div>
              <div className="text-sm font-black text-slate-950 pt-0.5">
                مكتب النائب علا الناشي — المكتب التنظيمي
              </div>
              <div className="text-[11px] font-semibold text-slate-600">
                {systemSettings?.province || 'محافظة ذي قار'}
              </div>
            </div>

            <div className="shrink-0 text-center">
              <img
                src={emblemSrc}
                alt="الشعار الرسمي"
                className="w-16 h-16 object-contain mx-auto"
                referrerPolicy="no-referrer"
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            <div className="text-left text-[11px] text-slate-700 space-y-1 shrink-0 tabular-nums">
              <div>
                <span className="font-bold text-slate-900">الرقم التعريفي: </span>
                <span className="font-mono font-extrabold text-slate-950">{citizen.Citizen_ID}</span>
              </div>
              <div>
                <span className="font-bold text-slate-900">تاريخ ووقت الطباعة: </span>
                <span>{printDateTime}</span>
              </div>
              <div>
                <span className="font-bold text-slate-900">نوع الوثيقة: </span>
                <span>سجل تنظيمي رسمي</span>
              </div>
            </div>
          </div>

          {/* Document Title Strip */}
          <div className="text-center py-2 bg-slate-100 border border-slate-300">
            <h1 className="text-base font-black text-slate-950">
              السجل التنظيمي الشامل وبيان الطلبات المقدمة
            </h1>
          </div>

          {/* Section 1: Citizen Identity & Organizational Stance Card */}
          <div className="print-avoid-break space-y-2.5">
            <h2 className="text-xs font-black text-slate-900 border-b border-slate-300 pb-1">
              أولاً: بيانات المراجع والموقف التنظيمي
            </h2>
            <table className="w-full border-collapse text-xs">
              <tbody>
                <tr>
                  <th className="w-1/6 bg-slate-100 border border-slate-300 py-1.5 px-2.5 text-right font-bold text-slate-800">
                    الاسم الكامل
                  </th>
                  <td className="w-2/6 border border-slate-300 py-1.5 px-2.5 font-extrabold text-slate-950">
                    {citizen.FullName}
                  </td>
                  <th className="w-1/6 bg-slate-100 border border-slate-300 py-1.5 px-2.5 text-right font-bold text-slate-800">
                    رقم الهاتف
                  </th>
                  <td className="w-2/6 border border-slate-300 py-1.5 px-2.5 font-mono font-bold tabular-nums text-right">
                    <span dir="ltr">{citizen.Phone1 || 'غير مسجل'}</span>
                  </td>
                </tr>
                <tr>
                  <th className="bg-slate-100 border border-slate-300 py-1.5 px-2.5 text-right font-bold text-slate-800">
                    العنوان والسكن
                  </th>
                  <td className="border border-slate-300 py-1.5 px-2.5 font-semibold text-slate-900">
                    {fullAddress}
                  </td>
                  <th className="bg-slate-100 border border-slate-300 py-1.5 px-2.5 text-right font-bold text-slate-800">
                    المعرّف / التزكية
                  </th>
                  <td className="border border-slate-300 py-1.5 px-2.5 font-semibold text-slate-900">
                    {citizen.ReferralSource || 'غير محدد'}
                  </td>
                </tr>
                <tr>
                  <th className="bg-slate-100 border border-slate-300 py-1.5 px-2.5 text-right font-bold text-slate-800">
                    الموقف التنظيمي
                  </th>
                  <td className="border border-slate-300 py-1.5 px-2.5 font-extrabold text-slate-950">
                    {citizenOrg?.OrgRating || 'غير محدد'}
                    {citizenOrg?.isTeamMember ? ` (${citizenOrg.teamMemberRole || 'عضو فريق عمل'})` : ''}
                  </td>
                  <th className="bg-slate-100 border border-slate-300 py-1.5 px-2.5 text-right font-bold text-slate-800">
                    التقييم النهائي
                  </th>
                  <td className="border border-slate-300 py-1.5 px-2.5 font-bold text-slate-900">
                    {citizenOrg?.finalEvaluation?.finalResult || 'بانتظار التقييم التنظيمي'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 4-Cell Summary Strip */}
            <table className="w-full border-collapse text-xs text-center">
              <tbody>
                <tr>
                  <td className="w-1/4 border border-slate-300 bg-slate-50 py-2 px-2">
                    <div className="text-[10px] font-bold text-slate-600">الطلبات المقدمة</div>
                    <div className="text-base font-black text-slate-950 tabular-nums mt-0.5">
                      {citizenRequests.length}
                    </div>
                  </td>
                  <td className="w-1/4 border border-slate-300 bg-slate-50 py-2 px-2">
                    <div className="text-[10px] font-bold text-slate-600">المقابلات البرلمانية</div>
                    <div className="text-base font-black text-slate-950 tabular-nums mt-0.5">
                      {citizenInterviews.length}
                    </div>
                  </td>
                  <td className="w-1/4 border border-slate-300 bg-slate-50 py-2 px-2">
                    <div className="text-[10px] font-bold text-slate-600">الوثائق المؤرشفة</div>
                    <div className="text-base font-black text-slate-950 tabular-nums mt-0.5">
                      {totalArchivedDocsCount}
                    </div>
                  </td>
                  <td className="w-1/4 border border-slate-300 bg-slate-50 py-2 px-2">
                    <div className="text-[10px] font-bold text-slate-600">الموقف التنظيمي</div>
                    <div className="text-sm font-black text-slate-950 mt-0.5">
                      {citizenOrg?.OrgRating || 'غير محدد'}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Submitted Requests Table */}
          <div className="space-y-2">
            <h2 className="text-xs font-black text-slate-900 border-b border-slate-300 pb-1">
              ثانياً: جدول الطلبات الإدارية والخدمية المقدمة ({citizenRequests.length})
            </h2>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="border border-slate-700 py-1.5 px-2 text-center w-8">ت</th>
                  <th className="border border-slate-700 py-1.5 px-2 text-right whitespace-nowrap">رقم الطلب</th>
                  <th className="border border-slate-700 py-1.5 px-2 text-right">الجهة المستهدفة</th>
                  <th className="border border-slate-700 py-1.5 px-2 text-right">الموضوع والتفاصيل</th>
                  <th className="border border-slate-700 py-1.5 px-2 text-right whitespace-nowrap">الصادر والتاريخ</th>
                  <th className="border border-slate-700 py-1.5 px-2 text-right whitespace-nowrap">الحالة / المرحلة</th>
                  <th className="border border-slate-700 py-1.5 px-2 text-right whitespace-nowrap">تاريخ التقديم</th>
                </tr>
              </thead>
              <tbody>
                {citizenRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-300 py-3 px-2 text-center text-slate-500">
                      لا توجد طلبات مسجلة لهذا المراجع.
                    </td>
                  </tr>
                ) : (
                  citizenRequests.map((req, idx) => {
                    const st = getRequestStatusMeta(req);
                    return (
                      <tr key={req.Request_ID} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-bold tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 font-mono font-bold tabular-nums whitespace-nowrap text-right">
                          <span dir="ltr">{req.Request_ID}</span>
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 font-bold text-slate-950">
                          {req.Entity || 'غير محددة'}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-slate-800 leading-snug">
                          {req.Details || '—'}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 tabular-nums whitespace-nowrap">
                          {req.OutgoingNumber
                            ? `${req.OutgoingNumber}${req.OutgoingDate ? ` (${formatReadableDateTime(req.OutgoingDate, false)})` : ''}`
                            : '—'}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 font-bold whitespace-nowrap">
                          {st.label}
                          {req.CurrentStage ? ` / ${req.CurrentStage}` : ''}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 tabular-nums whitespace-nowrap">
                          {formatReadableDateTime(req.CreatedAt || req.CreatedDate, false)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Section 3: Chronological Activity Timeline Table */}
          <div className="space-y-2">
            <h2 className="text-xs font-black text-slate-900 border-b border-slate-300 pb-1">
              ثالثاً: التسلسل الزمني للنشاطات والمراجعات ({timelineItems.length})
            </h2>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="border border-slate-700 py-1.5 px-2 text-center w-8">ت</th>
                  <th className="border border-slate-700 py-1.5 px-2 text-right whitespace-nowrap">التاريخ والوقت</th>
                  <th className="border border-slate-700 py-1.5 px-2 text-right whitespace-nowrap">نوع النشاط</th>
                  <th className="border border-slate-700 py-1.5 px-2 text-right">تفاصيل النشاط والملاحظات</th>
                  <th className="border border-slate-700 py-1.5 px-2 text-right whitespace-nowrap">المسؤول / الجهة</th>
                </tr>
              </thead>
              <tbody>
                {timelineItems.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="border border-slate-300 py-1.5 px-2 text-center font-bold tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-300 py-1.5 px-2 tabular-nums whitespace-nowrap">
                      {formatReadableDateTime(item.rawDate)}
                    </td>
                    <td className="border border-slate-300 py-1.5 px-2 font-bold whitespace-nowrap">
                      {item.badgeLabel}
                    </td>
                    <td className="border border-slate-300 py-1.5 px-2 leading-snug">
                      <div className="font-bold text-slate-950">{item.title}</div>
                      <div className="text-slate-700 mt-0.5">{item.details}</div>
                    </td>
                    <td className="border border-slate-300 py-1.5 px-2 whitespace-nowrap">
                      {item.actor || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Official Organizational Office Approval Footer */}
          <div className="print-avoid-break pt-4 mt-4 border-t-2 border-slate-900 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center text-xs">
              <div className="border border-slate-300 bg-slate-50 p-3 pb-8">
                <div className="font-extrabold text-slate-900">تنظيم وتدقيق</div>
                <div className="text-[11px] text-slate-600 mt-1">
                  {currentUser?.FullName || 'موظف المكتب التنظيمي'}
                </div>
              </div>
              <div className="border border-slate-300 bg-slate-50 p-3 pb-8">
                <div className="font-extrabold text-slate-900">مصادقة مسؤول قسم التنظيم</div>
                <div className="text-[11px] text-slate-600 mt-1">التوقيع والتاريخ</div>
              </div>
              <div className="border border-slate-300 bg-slate-50 p-3 pb-8">
                <div className="font-extrabold text-slate-900">اعتماد وختم المكتب التنظيمي</div>
                <div className="text-[11px] text-slate-600 mt-1">مكتب النائب علا الناشي</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1">
              <span>وثيقة رسمية صادرة عن مكتب النائب علا الناشي — المكتب التنظيمي</span>
              <span className="tabular-nums">تاريخ الطباعة: {printDateTime}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
