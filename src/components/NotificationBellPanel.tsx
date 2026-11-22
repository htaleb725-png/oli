import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Trash2,
  Volume2,
  VolumeX,
  AlertTriangle,
  FileText,
  Handshake,
  ShieldCheck,
  PackageCheck,
  Cloud,
  Sparkles,
  X,
  ArrowUpLeft
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UrgentNotification } from '../types';

interface NotificationBellPanelProps {
  onToast?: (msg: string) => void;
  onOpen?: () => void;
}

function formatRelativeArabicTime(iso?: string, fallback?: string): string {
  if (!iso) return fallback || 'الآن';
  const ts = Date.parse(iso);
  if (isNaN(ts)) return fallback || 'الآن';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} د`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `منذ ${diffHr} س`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  return new Date(ts).toLocaleDateString('ar-IQ');
}

function playSubtleChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.14);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 500);
  } catch {
    // AudioContext may be blocked until first user gesture
  }
}

export const NotificationBellPanel: React.FC<NotificationBellPanelProps> = ({ onToast, onOpen }) => {
  const {
    currentUser,
    notifications,
    requests,
    interviews,
    setActiveSection,
    markNotificationAsRead,
    dismissNotification,
    markAllNotificationsAsRead,
    clearReadNotifications
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'urgent'>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('al_nashi_notif_sound') !== 'muted';
    } catch {
      return true;
    }
  });
  const [dismissedLiveKeys, setDismissedLiveKeys] = useState<Set<string>>(new Set());

  const panelRef = useRef<HTMLDivElement>(null);
  const prevTopNotifIdRef = useRef<string | null>(null);
  const hasHydratedRef = useRef(false);

  const userRole = currentUser?.Role || '';

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  // Role-filtered persisted Firestore notifications
  const roleNotifications = useMemo(() => {
    return (notifications || []).filter((n) => {
      if (!n || !n.id) return false;
      if (!n.targetRoles || n.targetRoles.length === 0) return true;
      if (userRole === 'developer' || userRole === 'director' || userRole === 'deputy') return true;
      return n.targetRoles.includes(userRole);
    });
  }, [notifications, userRole]);

  // Live computed operational alerts (derived in real time from actual system records — zero fake mocks!)
  const liveComputedAlerts = useMemo<Array<UrgentNotification & { isComputed?: boolean }>>(() => {
    const computed: Array<UrgentNotification & { isComputed?: boolean }> = [];
    const todayIso = new Date().toISOString().split('T')[0];

    // 1. Pending requests awaiting Director decision
    if (['director', 'developer', 'deputy'].includes(userRole)) {
      const pendingDirector = (requests || []).filter(
        (r) => r && !r.IsHistoricalImported && !r.DirectorDecision && r.ProcessingStatus !== 'منجز' && r.ProcessingStatus !== 'مرفوض'
      ).length;
      if (pendingDirector > 0 && !dismissedLiveKeys.has('live_pending_director')) {
        computed.push({
          id: 'live_pending_director',
          title: `معاملات بانتظار توجيه المدير التنفيذي (${pendingDirector})`,
          message: `يوجد ${pendingDirector} طلب فعال بانتظار قرار الاعتماد أو التوجيه في لوحة المدير.`,
          timestamp: 'مباشر',
          type: 'director_decision',
          category: 'director',
          priority: 'urgent',
          linkSection: 'director',
          read: false,
          isComputed: true
        });
      }
    }

    // 2. Completed requests not yet picked up by citizen (غير مستلم)
    if (['admin', 'admin_officer', 'reception', 'reception_officer', 'director', 'developer'].includes(userRole)) {
      const awaitingPickup = (requests || []).filter(
        (r) => r && r.ProcessingStatus === 'منجز' && (r.DeliveryStatus === 'غير مستلم' || (!r.DeliveryStatus && r.RequestStatus === 'غير مستلم'))
      ).length;
      if (awaitingPickup > 0 && !dismissedLiveKeys.has('live_awaiting_pickup')) {
        computed.push({
          id: 'live_awaiting_pickup',
          title: `معاملات منجزة بانتظار استلام المراجع (${awaitingPickup})`,
          message: `يوجد ${awaitingPickup} معاملة مكتملة بحالة "غير مستلم" وجاهزة للتسليم.`,
          timestamp: 'مباشر',
          type: 'delivery_update',
          category: 'delivery',
          priority: 'high',
          linkSection: ['reception', 'reception_officer'].includes(userRole) ? 'reception' : 'admin',
          read: false,
          isComputed: true
        });
      }
    }

    // 3. Today's scheduled interviews
    if (['director', 'deputy', 'interviews_officer', 'developer', 'admin'].includes(userRole)) {
      const todayInterviews = (interviews || []).filter(
        (i) => i && i.Status === 'مجدولة' && String(i.InterviewDate || '').includes(todayIso)
      ).length;
      if (todayInterviews > 0 && !dismissedLiveKeys.has('live_today_interviews')) {
        computed.push({
          id: 'live_today_interviews',
          title: `مقابلات مجدولة لهذا اليوم (${todayInterviews})`,
          message: `يوجد ${todayInterviews} مقابلة برلمانية مجدولة اليوم في قسم مقابلات النائب.`,
          timestamp: 'اليوم',
          type: 'urgent_interview',
          category: 'interview',
          priority: 'high',
          linkSection: 'interviews',
          read: false,
          isComputed: true
        });
      }
    }

    return computed;
  }, [requests, interviews, userRole, dismissedLiveKeys]);

  // Combined notifications list
  const allItems = useMemo(() => {
    return [...liveComputedAlerts, ...roleNotifications];
  }, [liveComputedAlerts, roleNotifications]);

  const unreadCount = useMemo(() => allItems.filter((n) => !n.read).length, [allItems]);
  const urgentCount = useMemo(
    () => allItems.filter((n) => n.priority === 'urgent' || n.priority === 'high').length,
    [allItems]
  );

  // Subtle audio chime when a new real-time persisted notification arrives
  useEffect(() => {
    const newest = roleNotifications[0];
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      prevTopNotifIdRef.current = newest?.id || null;
      return;
    }
    if (newest && newest.id !== prevTopNotifIdRef.current && !newest.read) {
      prevTopNotifIdRef.current = newest.id;
      if (soundEnabled) {
        playSubtleChime();
      }
    }
  }, [roleNotifications, soundEnabled]);

  const filteredItems = useMemo(() => {
    if (filterTab === 'unread') return allItems.filter((n) => !n.read);
    if (filterTab === 'urgent') return allItems.filter((n) => n.priority === 'urgent' || n.priority === 'high');
    return allItems;
  }, [allItems, filterTab]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('al_nashi_notif_sound', next ? 'on' : 'muted');
    } catch {}
    if (next) playSubtleChime();
    onToast?.(next ? 'تم تفعيل صوت التنبيهات الفورية' : 'تم كتم صوت التنبيهات');
  };

  const renderCategoryIcon = (item: UrgentNotification) => {
    const cat = item.category || item.type;
    if (cat === 'director' || cat === 'director_decision') {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
      );
    }
    if (cat === 'interview' || cat === 'urgent_interview') {
      return (
        <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
          <Handshake className="w-4 h-4" />
        </div>
      );
    }
    if (cat === 'delivery' || cat === 'delivery_update') {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
          <PackageCheck className="w-4 h-4" />
        </div>
      );
    }
    if (cat === 'drive' || cat === 'drive_upload') {
      return (
        <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
          <Cloud className="w-4 h-4" />
        </div>
      );
    }
    if (item.priority === 'urgent') {
      return (
        <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) onOpen?.();
        }}
        className={`relative p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
          isOpen
            ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
            : unreadCount > 0
            ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300'
        }`}
        aria-label="مركز التنبيهات والإشعارات"
        title={unreadCount > 0 ? `لديك ${unreadCount} تنبيه غير مقروء` : 'مركز التنبيهات والإشعارات'}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
        ) : (
          <Bell className="w-4.5 h-4.5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black tabular-nums flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2.5 w-[340px] sm:w-[410px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/90 shadow-2xl overflow-hidden z-50 text-right">
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-50/90 dark:bg-slate-950/70 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                  مركز التنبيهات الفوري
                </h4>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {unreadCount > 0 ? `${unreadCount} تنبيه غير مقروء` : 'جميع التنبيهات مقروءة'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title={soundEnabled ? 'كتم صوت التنبيهات' : 'تفعيل صوت التنبيهات'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs & Bulk Actions */}
          <div className="px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                الكل ({allItems.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('unread')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  filterTab === 'unread'
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                غير مقروء ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('urgent')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  filterTab === 'urgent'
                    ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                مهم ({urgentCount})
              </button>
            </div>

            {roleNotifications.some((n) => !n.read) && (
              <button
                type="button"
                onClick={() => {
                  markAllNotificationsAsRead();
                  onToast?.('تم تحديد جميع التنبيهات كمقروءة');
                }}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>قراءة الكل</span>
              </button>
            )}
          </div>

          {/* Notification Items List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredItems.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {filterTab === 'unread' ? 'لا توجد تنبيهات غير مقروءة' : 'لا توجد تنبيهات حالياً'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ستظهر هنا جميع الإشعارات الفورية للطلبات، توجيهات المدير، والمقابلات تلقائياً.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isComputed = Boolean((item as any).isComputed);
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 transition-colors group ${
                      item.read
                        ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        : 'bg-blue-50/55 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {renderCategoryIcon(item)}

                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          if (!isComputed && !item.read) {
                            markNotificationAsRead(item.id);
                          }
                          if (item.linkSection) {
                            setActiveSection(item.linkSection);
                          }
                          setIsOpen(false);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white leading-snug line-clamp-1">
                            {item.title}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                            {formatRelativeArabicTime(item.createdAtIso, item.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                          {item.message}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {item.priority === 'urgent' && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
                                عاجل
                              </span>
                            )}
                            {isComputed && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                                متابعة مباشرة
                              </span>
                            )}
                            {item.createdBy && !isComputed && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[130px]">
                                بواسطة: {item.createdBy}
                              </span>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 opacity-80 group-hover:opacity-100">
                            <span>انتقال</span>
                            <ArrowUpLeft className="w-3 h-3" />
                          </span>
                        </div>
                      </div>

                      {/* Quick item actions */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        {!isComputed && !item.read && (
                          <button
                            type="button"
                            onClick={() => markNotificationAsRead(item.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                            title="تحديد كمقروء"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (isComputed) {
                              setDismissedLiveKeys((prev) => new Set(prev).add(item.id));
                            } else {
                              dismissNotification(item.id);
                            }
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                          title="إخفاء التنبيه"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {roleNotifications.some((n) => n.read) && (
            <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-slate-950/70 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                متزامن سحابياً عبر جميع الأجهزة
              </span>
              <button
                type="button"
                onClick={() => {
                  clearReadNotifications();
                  onToast?.('تم مسح التنبيهات المقروءة');
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح المقروءة</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
