import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { purgeLegacyBrowserBusinessData } from '../utils/safeStorage';

interface Props {
  children: ReactNode;
  sectionName?: string;
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `Uncaught error caught by ErrorBoundary${this.props.sectionName ? ` [${this.props.sectionName}]` : ''}:`,
      error,
      errorInfo
    );
    if (error && (error.message?.includes('quota') || error.name === 'QuotaExceededError')) {
      try {
        purgeLegacyBrowserBusinessData();
      } catch {}
    }
    this.setState({ errorInfo });
  }

  private handleResetSection = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.compact) {
        return (
          <div className="max-w-2xl mx-auto my-8 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-500/40 rounded-2xl p-6 shadow-lg text-center space-y-4" dir="rtl">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>عزل الأعطال المستقل للأقسام</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                حدث خطأ معزول داخل هذا القسم فقط ({this.props.sectionName || 'القسم النشط'})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                باقي أقسام المنظومة وبيانات قاعدة البيانات السحابية آمنة تماماً ولم تتأثر. يمكنك إعادة تحميل هذا القسم أو الانتقال لأي قسم آخر من القائمة العلوية.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-right text-[11px] font-mono text-rose-600 dark:text-rose-300 overflow-x-auto max-h-28">
                {this.state.error.toString()}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={this.handleResetSection}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة تشغيل هذا القسم</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                تحديث الصفحة بالكامل
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" dir="rtl">
          <div className="max-w-lg w-full bg-slate-900/90 backdrop-blur-xl border border-rose-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-950/60 border border-rose-500/20 text-rose-300 text-xs font-bold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>نظام الحماية من الشاشة البيضاء والانهيار</span>
              </div>
              <h2 className="text-xl font-black text-white">
                تم استعادة تشغيل المنظومة بأمان
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                حدث خطأ غير متوقع في عرض الواجهة. جميع السجلات محفوظة بأمان في قاعدة البيانات السحابية.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-right text-[11px] font-mono text-rose-300/90 overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة تحديث الصفحة</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
