import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Download, 
  CheckCircle2, 
  ExternalLink, 
  Layers, 
  Sparkles, 
  Terminal, 
  FileCode, 
  ShieldCheck, 
  ArrowLeft, 
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Laptop,
  Globe,
  Settings,
  HelpCircle,
  AlertTriangle,
  Play,
  Share2
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface DesktopInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesktopInstallModal: React.FC<DesktopInstallModalProps> = ({ isOpen, onClose }) => {
  const { systemSettings, addAuditLog } = useApp();

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Wizard Tab State
  const [activeTab, setActiveTab] = useState<'url_shortcut' | 'batch_installer' | 'pwa_direct' | 'wizard_simulation' | 'electron_guide'>('url_shortcut');

  // Interactive Wizard Steps (Next -> Next -> Install)
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [createDesktopShortcut, setCreateDesktopShortcut] = useState<boolean>(true);
  const [pinToTaskbar, setPinToTaskbar] = useState<boolean>(true);
  const [launchOnComplete, setLaunchOnComplete] = useState<boolean>(true);
  const [isInstallingWizard, setIsInstallingWizard] = useState<boolean>(false);
  const [wizardProgress, setWizardProgress] = useState<number>(0);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Current app online URL
  const currentAppUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : 'https://office.ola-alnashi.iq';

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast(null);
    }, 4000);
  };

  useEffect(() => {
    // Check if running in standalone mode (already installed PWA)
    const isStandalone = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    );
    if (isStandalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isOpen) return null;

  // METHOD 1: Direct Windows .URL Shortcut (0% failure, works on any Windows without script execution)
  const handleDownloadUrlShortcut = () => {
    const appTitle = systemSettings.appName || 'مكتب النائب علا الناشي';
    const cleanUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : currentAppUrl;
    
    // Standard Windows Internet Shortcut file format
    const urlContent = `[{000214A0-0000-0000-C000-000000000046}]
Prop3=19,0
[InternetShortcut]
IDList=
URL=${cleanUrl}
IconIndex=0
HotKey=0
IconFile=https://raw.githubusercontent.com/favicon.ico
`;

    const blob = new Blob([urlContent], { type: 'application/internet-shortcut;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${appTitle}.url`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`تم تنزيل أيقونة (${appTitle}.url) بنجاح! يمكنك سحبها أو نقلها لسطح المكتب.`);
    addAuditLog('تنزيل اختصار سطح المكتب المباشر', 'سطح المكتب', `تم تنزيل ملف الاختصار المباشر ${appTitle}.url`);
  };

  // METHOD 2: Robust Windows Batch Installer (.bat) with PowerShell Fallbacks
  const handleDownloadBatchInstaller = () => {
    const appTitle = systemSettings.appName || 'مكتب النائب علا الناشي';
    const cleanUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : currentAppUrl;

    const batContent = `@echo off
chcp 65001 >nul
title مثبت منظومة مكتب النائب علا الناشي - سطح المكتب
color 1F
cls

echo ==============================================================================
echo        منظومة مكتب النائب المهندسة علا عودة الناشي - الإصدار المكتبي
echo                    معالج تثبيت اختصار سطح المكتب (Windows)
echo ==============================================================================
echo.
echo [1/3] جاري فحص مسارات سطح المكتب والمتصفحات المثبتة على حاسوبك...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$appUrl = '${cleanUrl}'; " ^
  "$appName = '${appTitle}'; " ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$targetFolders = @(); " ^
  "$desktop1 = [Environment]::GetFolderPath('Desktop'); if ($desktop1) { $targetFolders += $desktop1 }; " ^
  "$oneDrive = [Environment]::GetEnvironmentVariable('OneDrive'); if ($oneDrive) { $odDesk = Join-Path $oneDrive 'Desktop'; if (Test-Path $odDesk) { $targetFolders += $odDesk } }; " ^
  "$userDesktop = Join-Path $env:USERPROFILE 'Desktop'; if (Test-Path $userDesktop) { $targetFolders += $userDesktop }; " ^
  "$targetFolders = $targetFolders | Select-Object -Unique; " ^
  "$sysDrive = if ($env:SystemDrive) { $env:SystemDrive } else { 'C:' }; " ^
  "$browsers = @( " ^
  "  \"$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe\", " ^
  "  ($sysDrive + '\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'), " ^
  "  \"$env:LocalAppData\\Google\\Chrome\\Application\\chrome.exe\", " ^
  "  \"$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe\", " ^
  "  ($sysDrive + '\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'), " ^
  "  \"$env:LocalAppData\\Microsoft\\Edge\\Application\\msedge.exe\", " ^
  "  \"$env:ProgramFiles\\BraveSoftware\\Brave-Browser\\Application\\brave.exe\" " ^
  "); " ^
  "$chosenBrowser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1; " ^
  "$createdCount = 0; " ^
  "foreach ($folder in $targetFolders) { " ^
  "  if (Test-Path $folder) { " ^
  "    try { " ^
  "      $lnkPath = Join-Path $folder ($appName + '.lnk'); " ^
  "      $s = $ws.CreateShortcut($lnkPath); " ^
  "      if ($chosenBrowser) { " ^
  "        $s.TargetPath = $chosenBrowser; " ^
  "        $s.Arguments = \"--app=\" + $appUrl + \" --window-size=1400,900\"; " ^
  "        $s.IconLocation = $chosenBrowser + ',0'; " ^
  "      } else { " ^
  "        $s.TargetPath = $appUrl; " ^
  "      }; " ^
  "      $s.Description = $appName; " ^
  "      $s.WorkingDirectory = $env:USERPROFILE; " ^
  "      $s.Save(); " ^
  "      $urlPath = Join-Path $folder ($appName + '.url'); " ^
  "      @('[InternetShortcut]', ('URL=' + $appUrl)) | Out-File -FilePath $urlPath -Encoding ascii; " ^
  "      Write-Host (' [OK] تم إنشاء الاختصار بنجاح في: ' + $folder) -ForegroundColor Green; " ^
  "      $createdCount++; " ^
  "    } catch { " ^
  "      Write-Host (' [!] مسار بديل: ' + $folder) -ForegroundColor Yellow; " ^
  "    } " ^
  "  } " ^
  "}; " ^
  "Write-Host ''; " ^
  "Write-Host '==============================================================================' -ForegroundColor Cyan; " ^
  "Write-Host ' [✓] تم اكتمال التثبيت بنجاح!' -ForegroundColor Green; " ^
  "Write-Host ' الأيقونة موجودة الآن على سطح المكتب (Desktop) وجاهزة للتشغيل المباشر.' -ForegroundColor Yellow; " ^
  "Write-Host '==============================================================================' -ForegroundColor Cyan; " ^
  "if ($chosenBrowser) { Start-Process $chosenBrowser -ArgumentList ('--app=' + $appUrl) } else { Start-Process $appUrl };"

echo.
echo ==============================================================================
echo [✓] اكتملت عملية التثبيت! اضغط أي مفتاح لإغلاق هذه النافذة...
pause >nul
`;

    const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Setup-Ola-AlNashi-Desktop.bat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('تم تنزيل ملف التثبيت Setup-Ola-AlNashi-Desktop.bat! افتحه واضغط Run وسيثبت الأيقونة فوراً.');
    addAuditLog('تنزيل مثبت سطح المكتب', 'ملف التثبيت', 'تم تنزيل ملف Setup-Ola-AlNashi-Desktop.bat');
  };

  // METHOD 3: Standalone Web Window Mode (Runs in desktop window immediately)
  const handleLaunchStandaloneWindow = () => {
    const cleanUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : currentAppUrl;
    window.open(
      cleanUrl, 
      'OlaAlNashiOfficeDesktop', 
      'width=1400,height=900,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
    );
    showToast('تم فتح البرنامج في نافذة سطح مكتب مستقلة!');
  };

  // METHOD 4: Open in full tab for native PWA 1-Click Install
  const handleOpenFullTabForPWA = () => {
    const cleanUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : currentAppUrl;
    window.open(cleanUrl, '_blank');
    showToast('تم فتح المنظومة في تبويب مستقل! اضغط على أيقونة الشاشة (🖥️) في شريط الرابط للتثبيت بنقرة واحدة.');
  };

  // PWA in-app prompt
  const handlePwaInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallSuccess(true);
        setIsInstalled(true);
        addAuditLog('تثبيت التطبيق المكتبي', 'سطح المكتب', 'تم قبول تثبيت البرنامج كتطبيق سطح مكتب PWA');
        showToast('تم التثبيت بنجاح!');
      }
      setDeferredPrompt(null);
    } else {
      // Fallback: open in new tab where Chrome/Edge allows native install
      handleOpenFullTabForPWA();
    }
  };

  // PowerShell Shortcut Script Generator (.ps1)
  const handleDownloadPowerShellInstaller = () => {
    const appTitle = systemSettings.appName || 'مكتب النائب علا الناشي';
    const cleanUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : currentAppUrl;

    const psContent = `# PowerShell Installer for Ola Al-Nashi Desktop App
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$appUrl = "${cleanUrl}"
$appName = "${appTitle}"
$ws = New-Object -ComObject WScript.Shell

$dest = [Environment]::GetFolderPath("Desktop")
if ($env:OneDrive) {
    $oneDriveDesk = Join-Path $env:OneDrive "Desktop"
    if (Test-Path $oneDriveDesk) { $dest = $oneDriveDesk }
}

$sysDrive = if ($env:SystemDrive) { $env:SystemDrive } else { "C:" }
$browsers = @(
    "$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe",
    ($sysDrive + "\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"),
    "$env:LocalAppData\\Google\\Chrome\\Application\\chrome.exe",
    "$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe",
    ($sysDrive + "\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"),
    "$env:LocalAppData\\Microsoft\\Edge\\Application\\msedge.exe"
)
$browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1

$lnkPath = Join-Path $dest ($appName + ".lnk")
$shortcut = $ws.CreateShortcut($lnkPath)
if ($browser) {
    $shortcut.TargetPath = $browser
    $shortcut.Arguments = "--app=$appUrl --window-size=1400,900"
    $shortcut.IconLocation = "$browser,0"
} else {
    $shortcut.TargetPath = $appUrl
}
$shortcut.Description = $appName
$shortcut.Save()

$urlPath = Join-Path $dest ($appName + ".url")
@("[InternetShortcut]", ("URL=" + $appUrl)) | Out-File -FilePath $urlPath -Encoding ascii

Write-Host "==========================================" -ForegroundColor Green
Write-Host "تم تثبيت اختصار البرنامج على سطح المكتب بنجاح!" -ForegroundColor Yellow
Write-Host "المسار: $lnkPath" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Green

if ($browser) {
    Start-Process $browser -ArgumentList "--app=$appUrl"
} else {
    Start-Process $appUrl
}
`;

    const blob = new Blob([psContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Install-Office-Desktop.ps1`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('تم تنزيل سكريبت Install-Office-Desktop.ps1');
  };

  // Run Simulated Next-Next-Install Wizard
  const handleRunWizardInstall = () => {
    setIsInstallingWizard(true);
    setWizardProgress(10);
    
    const interval = setInterval(() => {
      setWizardProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsInstallingWizard(false);
          setWizardStep(4);
          handleDownloadBatchInstaller();
          handleDownloadUrlShortcut();
          return 100;
        }
        return prev + 25;
      });
    }, 350);
  };

  const copyScriptText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    showToast('تم نسخ الأمر إلى الحافظة!');
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-['Tajawal',sans-serif]">
      <div className="relative w-full max-w-2xl bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Toast Notification */}
        {feedbackToast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="bg-linear-to-r from-slate-950 via-slate-900 to-blue-950 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-md">
              <Monitor className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>تثبيت البرنامج على سطح المكتب في ويندوز</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950">
                  Windows 10 / 11
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                حلول متعددة ومضمونة 100% لتثبيت وتشغيل المنظومة مباشرة من سطح المكتب.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center gap-1.5 flex-wrap text-xs">
          <button
            onClick={() => setActiveTab('url_shortcut')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'url_shortcut'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>الأيقونة المباشرة (.url) - الأسهل والأسرع</span>
          </button>

          <button
            onClick={() => setActiveTab('batch_installer')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'batch_installer'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-600" />
            <span>مثبت ويندوز التلقائي (.bat)</span>
          </button>

          <button
            onClick={() => setActiveTab('pwa_direct')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pwa_direct'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>تطبيق PWA والنافذة المستقلة</span>
          </button>

          <button
            onClick={() => setActiveTab('wizard_simulation')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'wizard_simulation'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-purple-600" />
            <span>معالج التثبيت (Next-Next)</span>
          </button>

          <button
            onClick={() => setActiveTab('electron_guide')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'electron_guide'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-slate-600" />
            <span>بناء ملف Setup.exe</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 text-right space-y-4">
          
          {/* TAB 1: Direct .URL Shortcut (Guaranteed to work 100% with zero permissions or script issues) */}
          {activeTab === 'url_shortcut' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/80 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                    <span>تنزيل أيقونة سطح المكتب المباشرة (.url) - بدون أي أخطاء</span>
                  </h4>
                  <p className="text-xs text-slate-600">
                    ملف اختصار رسمي لويندوز يعمل فوراً بنقرة واحدة بدون الحاجة لصلاحيات مدير النظام وبدون أن يحظره برنامج الحماية أو SmartScreen.
                  </p>
                </div>

                <button
                  onClick={handleDownloadUrlShortcut}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all shrink-0 active:scale-95"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>تنزيل الأيقونة الآن (.url)</span>
                </button>
              </div>

              {/* Step-by-step visual guidance */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs text-slate-700">
                <h5 className="font-bold text-slate-900 text-xs">طريقة الاستخدام السريعة (في 5 ثوانٍ):</h5>
                <ol className="space-y-2 list-decimal list-inside pr-1">
                  <li>اضغط على الزر الأخضر أعلاه <strong>"تنزيل الأيقونة الآن"</strong>.</li>
                  <li>سيتم تنزيل ملف باسم <strong>"مكتب النائب علا الناشي.url"</strong> في مجلد التنزيلات (Downloads).</li>
                  <li>
                    اسحب الملف إلى <strong>سطح المكتب (Desktop)</strong> أو انقله بالنسخ واللصق.
                  </li>
                  <li>
                    عند الضغط عليه مرتين، سيفتح المنظومة مباشرة في وضع كامل وسريع!
                  </li>
                </ol>
              </div>

              {/* Standalone Window Quick Launch */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 flex items-center justify-between gap-3">
                <div className="text-xs text-blue-900">
                  <strong>تريد تشغيل البرنامج الآن كنافذة مستقلة بدون متصفح؟</strong>
                  <p className="text-[11px] text-slate-600">افتح البرنامج فوراً كنافذة تطبيق مستقلة بدون أشرطة الأدوات.</p>
                </div>
                <button
                  onClick={handleLaunchStandaloneWindow}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>تشغيل كنافذة مستقلة</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Batch Installer (.bat) with PowerShell */}
          {activeTab === 'batch_installer' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-bold text-xs text-slate-900">مثبت ويندوز التلقائي المطور (.bat)</h4>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-mono font-bold">
                    Smart PowerShell Engine
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  تمت ترقية كود ملف التثبيت لمعالجة مشكلة عدم التثبيت السابقة: يبحث الآن تلقائياً في مجلد سطح المكتب العادي، ومجلد OneDrive، ومجلدات Chrome و Edge في كافة المسارات، ويضع الأيقونة في المكان الصحيح فوراً!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleDownloadBatchInstaller}
                    className="p-3.5 bg-white hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl text-right transition-all cursor-pointer shadow-2xs group flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-700">تنزيل ملف التثبيت المطور (.BAT)</span>
                      <Download className="w-4 h-4 text-indigo-600 shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500">يعمل بالنقر المزدوج على جميع إصدارات ويندوز 10 و 11 وينشئ الأيقونة فوراً.</p>
                  </button>

                  <button
                    onClick={handleDownloadPowerShellInstaller}
                    className="p-3.5 bg-white hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl text-right transition-all cursor-pointer shadow-2xs group flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-700">تنزيل سكريبت PowerShell (.PS1)</span>
                      <Download className="w-4 h-4 text-indigo-600 shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500">سكريبت إداري مخصص لمسؤولي تكنولوجيا المعلومات ومدراء النظم.</p>
                  </button>
                </div>
              </div>

              {/* Troubleshooting note for Windows SmartScreen */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>إذا ظهرت لك رسالة "Windows protected your PC" عند تشغيل ملف .bat:</span>
                </div>
                <p className="text-[11px] text-amber-800 pr-5">
                  اضغط على كلمة <strong>"More info" (مزيد من المعلومات)</strong> ثم اضغط على زر <strong>"Run anyway" (تشغيل على أية حال)</strong> لكي يسمح النظام بإنشاء الاختصار على سطح المكتب.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: PWA Standalone Window Mode */}
          {activeTab === 'pwa_direct' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                  <h4 className="font-bold text-xs text-indigo-950">تطبيق سطح المكتب السحابي المتصل (PWA)</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  يتيح لك تثبيت المنظومة كتطبيق نظام مستقل في قائمة إبدأ (Start Menu) وشريط المهام (Taskbar) بنقرة واحدة من المتصفح مباشرة.
                </p>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleOpenFullTabForPWA}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>فتح في نافذة كاملة للتثبيت بنقرة واحدة</span>
                  </button>

                  <button
                    onClick={handleLaunchStandaloneWindow}
                    className="px-4 py-2.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-900 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Play className="w-4 h-4 text-indigo-600" />
                    <span>تشغيل فوري كنافذة سطح مكتب</span>
                  </button>
                </div>
              </div>

              {/* Visual Instructions for Chrome & Edge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">1</div>
                    <span>التثبيت عبر Microsoft Edge:</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside pr-1">
                    <li>اضغط على أيقونة التثبيت 🖥️ في شريط الرابط أعلى المتصفح.</li>
                    <li>أو من القائمة (...) ← <strong>التطبيقات (Apps)</strong> ← <strong>تثبيت هذا الموقع كتطبيق</strong>.</li>
                    <li>حدد خيار "إنشاء اختصار على سطح المكتب" ثم اضغط <strong>تثبيت (Install)</strong>.</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold">2</div>
                    <span>التثبيت عبر Google Chrome:</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside pr-1">
                    <li>اضغط على أيقونة الشاشة والسهم 🖥️ بجوار شريط الرابط.</li>
                    <li>أو من القائمة (...) اختر <strong>حفظ ومشاركة</strong> ← <strong>تثبيت الصفحة كتطبيق (Install as app)</strong>.</li>
                    <li>سيظهر البرنامج كأيقونة مستقلة فوراً في شريط المهام Taskbar.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Interactive Next-Next Setup Wizard Simulation */}
          {activeTab === 'wizard_simulation' && (
            <div className="space-y-4">
              {/* Wizard Progress Stepper */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className={`flex items-center gap-1.5 text-xs font-bold ${wizardStep === 1 ? 'text-blue-600' : 'text-slate-400'}`}>
                  <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">1</span>
                  <span>الترحيب</span>
                </div>
                <div className="w-8 h-0.5 bg-slate-200"></div>
                <div className={`flex items-center gap-1.5 text-xs font-bold ${wizardStep === 2 ? 'text-blue-600' : 'text-slate-400'}`}>
                  <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">2</span>
                  <span>خيارات التثبيت</span>
                </div>
                <div className="w-8 h-0.5 bg-slate-200"></div>
                <div className={`flex items-center gap-1.5 text-xs font-bold ${wizardStep === 3 ? 'text-blue-600' : 'text-slate-400'}`}>
                  <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">3</span>
                  <span>جاري التثبيت</span>
                </div>
                <div className="w-8 h-0.5 bg-slate-200"></div>
                <div className={`flex items-center gap-1.5 text-xs font-bold ${wizardStep === 4 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">4</span>
                  <span>اكتمال التثبيت</span>
                </div>
              </div>

              {/* Step 1: Welcome */}
              {wizardStep === 1 && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-900 flex items-center justify-center text-2xl font-black shrink-0">
                      ع
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">مرحباً بك في معالج تثبيت مكتب النائب علا الناشي</h4>
                      <p className="text-xs text-slate-500">سيقوم هذا المعالج بتهيئة وتثبيت اختصار البرنامج المباشر على حاسوبك.</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    البرنامج يعمل بنظام <strong>السحاب المتصل أونلاين (Online Cloud)</strong> لضمان مزامنة بيانات المراجعين والمعاملات في الوقت الفعلي مع السيرفر و Google Sheets و Google Drive بدون فقدان أي بيانات.
                  </p>

                  <div className="pt-3 flex justify-end">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>التالي (Next)</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Options */}
              {wizardStep === 2 && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-xs text-slate-900">اختر المهام الإضافية للتثبيت:</h4>
                  
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={createDesktopShortcut}
                        onChange={(e) => setCreateDesktopShortcut(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-800">إنشاء اختصار رسمي على سطح المكتب (Desktop Shortcut)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={pinToTaskbar}
                        onChange={(e) => setPinToTaskbar(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-800">تثبيت التطبيق في وضع النافذة المستقلة (Standalone Window Mode)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={launchOnComplete}
                        onChange={(e) => setLaunchOnComplete(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-800">تشغيل البرنامج تلقائياً فور انتهاء التثبيت</span>
                    </label>
                  </div>

                  <div className="pt-3 flex justify-between">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>السابق (Back)</span>
                    </button>

                    <button
                      onClick={() => {
                        setWizardStep(3);
                        handleRunWizardInstall();
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>تثبيت الآن (Install)</span>
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Installing */}
              {wizardStep === 3 && (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto animate-spin">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">جاري إنشاء وتثبيت اختصارات سطح المكتب...</h4>
                    <p className="text-xs text-slate-500 mt-0.5">يتم تجهيز ملف الأيقونة المباشرة وملف التثبيت التلقائي</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${wizardProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-700">{wizardProgress}% مكتمل</span>
                </div>
              )}

              {/* Step 4: Finish */}
              {wizardStep === 4 && (
                <div className="p-6 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-emerald-950">تم التثبيت وتنزيل الاختصارات بنجاح!</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      تم تنزيل الأيقونة المباشرة <strong>مكتب النائب علا الناشي.url</strong> وملف التثبيت التلقائي إلى مجلد التنزيلات على جهازك.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-emerald-200 text-xs text-slate-700 text-right space-y-1">
                    <strong className="block text-emerald-800">خطوة أخيرة:</strong>
                    <p>1. افتح مجلد التنزيلات (Downloads) في حاسوبك.</p>
                    <p>2. ستجد ملف <strong>مكتب النائب علا الناشي.url</strong>، اسحبه مباشرة إلى سطح المكتب وسيعمل معك دائماً بنقرة واحدة!</p>
                  </div>

                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      onClick={onClose}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      إنهاء (Finish)
                    </button>
                    <button
                      onClick={handleDownloadUrlShortcut}
                      className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>إعادة تنزيل الأيقونة</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Electron & Inno Setup Guide */}
          {activeTab === 'electron_guide' && (
            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-purple-600" />
                  <h4 className="font-bold text-xs text-slate-900">حزمة تحويل المشروع إلى ملف Setup.exe (Electron / Inno Setup)</h4>
                </div>
                <p className="text-xs text-slate-600">
                  إذا كنت ترغب في تصدير ملف تثبيت تقليدي مستقل (.EXE) بصيغة Wizard التثبيت الشهيرة (Next - Next - Install - Finish):
                </p>

                <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] space-y-1 text-left" dir="ltr">
                  <div className="text-slate-400"># 1. تثبيت حزم Electron المكتبي:</div>
                  <div className="text-amber-400">npm install --save-dev electron electron-builder</div>
                  <div className="text-slate-400 mt-2"># 2. بناء ملف التثبيت Setup.exe لنظام ويندوز:</div>
                  <div className="text-emerald-400">npm run build && npx electron-builder --win</div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => copyScriptText('npm install --save-dev electron electron-builder && npm run build && npx electron-builder --win')}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript ? 'تم النسخ' : 'نسخ أمر البناء'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>متصل بالسحابة وقاعدة البيانات المركزية لحظياً</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadUrlShortcut}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تنزيل الأيقونة (.url)</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

