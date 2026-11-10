import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Sparkles, 
  Maximize2, 
  Minimize2,
  Film,
  Building2,
  Award
} from 'lucide-react';
import gavelStrikeImg from '../assets/images/gavel_strike_action_1794297701814.jpg';
import gavelRestImg from '../assets/images/parliament_gavel_4k_1794297685644.jpg';
import parliamentDomeImg from '../assets/images/parliament_grand_hall_1794297718914.jpg';
import { playParliamentGavelStrikeSound } from '../utils/audio';

// High-definition parliamentary & judicial video loop sources
const VIDEO_FEEDS = [
  {
    id: 'gavel_action',
    title: 'افتتاح الجلسة بطرق المطرقة الرئاسية',
    subtitle: 'لقطة مقربة 4K للمطرقة الذهبية وقاعدة الرنين',
    image: gavelStrikeImg,
    badge: '4K ULTRA HD',
    duration: 12
  },
  {
    id: 'gavel_podium',
    title: 'مطرقة الرئاسة ومنصة مجلس النواب',
    subtitle: 'قاعة المجلس الكبرى ومنصة رئاسة البرلمان',
    image: gavelRestImg,
    badge: '4K CINEMATIC',
    duration: 15
  },
  {
    id: 'grand_assembly',
    title: 'القبة الذهبية وقاعة المجلس البانورامية',
    subtitle: 'المشهد الكامل لقاعة البرلمان العراقي والأعلام الوطنية',
    image: parliamentDomeImg,
    badge: '8K PANORAMA',
    duration: 18
  }
];

interface Parliament4KVideoPlayerProps {
  onStrikeGavel?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Parliament4KVideoPlayer: React.FC<Parliament4KVideoPlayerProps> = ({
  onStrikeGavel,
  isSidebarCollapsed = false,
  onToggleSidebar
}) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5>(1);
  const [progress, setProgress] = useState(0);
  const [isStriking, setIsStriking] = useState(false);
  const [strikeFlash, setStrikeFlash] = useState(false);
  const [screenShake, setScreenShake] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentScene = VIDEO_FEEDS[currentSceneIndex];

  // Acoustic gavel strike trigger with visual shockwave and screen shake
  const handleTriggerGavelStrike = useCallback(() => {
    setIsStriking(true);
    setStrikeFlash(true);
    setScreenShake(true);

    if (soundEnabled) {
      playParliamentGavelStrikeSound();
    }

    if (onStrikeGavel) {
      onStrikeGavel();
    }

    // Switch to the dramatic gavel strike scene if not already there
    if (currentSceneIndex !== 0) {
      setCurrentSceneIndex(0);
      setProgress(0);
    }

    setTimeout(() => {
      setStrikeFlash(false);
    }, 400);

    setTimeout(() => {
      setScreenShake(false);
      setIsStriking(false);
    }, 900);
  }, [currentSceneIndex, onStrikeGavel, soundEnabled]);

  // Handle timeline progression and seamless scene cycling
  useEffect(() => {
    if (!isPlaying) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    const sceneDuration = currentScene.duration / playbackSpeed;
    const intervalMs = 100;
    const step = (intervalMs / (sceneDuration * 1000)) * 100;

    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          // Cycle to next scene
          setCurrentSceneIndex(prevIndex => (prevIndex + 1) % VIDEO_FEEDS.length);
          return 0;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, currentSceneIndex, playbackSpeed, currentScene.duration]);

  // Jump to specific scene
  const handleSelectScene = (index: number) => {
    setCurrentSceneIndex(index);
    setProgress(0);
    setIsPlaying(true);
  };

  // Interactive timeline scrub
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    setProgress(newProgress);
  };

  return (
    <div 
      className={`relative w-full h-full overflow-hidden select-none bg-black flex flex-col justify-between ${
        screenShake ? 'translate-y-[-2px] scale-[1.01] transition-transform duration-75' : ''
      }`}
      dir="rtl"
    >
      {/* 4K Video / Cinematic Canvas Stage */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {VIDEO_FEEDS.map((scene, idx) => {
          const isActive = idx === currentSceneIndex;
          return (
            <div
              key={scene.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
              }`}
            >
              {/* Ultra-realistic 4K Motion Image with Dynamic Cinematic Ken-Burns Pan */}
              <img
                src={scene.image}
                alt={scene.title}
                className={`w-full h-full object-cover object-center transition-transform duration-[18000ms] ease-out ${
                  isActive && isPlaying 
                    ? idx === 0 ? 'scale-115 translate-x-2 translate-y-[-1%]' 
                    : idx === 1 ? 'scale-110 translate-x-[-2%] translate-y-1' 
                    : 'scale-120 translate-y-[-3%]'
                    : 'scale-105'
                }`}
              />

              {/* Cinematic Vignette & Warm Presidential Lighting Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#060b14] via-transparent to-[#060b14]/70 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#060b14]/90 via-transparent to-transparent pointer-events-none" />
              
              {/* Subtle film grain & golden atmosphere */}
              <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-black/60 pointer-events-none" />
            </div>
          );
        })}

        {/* Dynamic Gavel Strike Shockwave Flash */}
        {strikeFlash && (
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400/35 via-yellow-200/50 to-amber-500/35 backdrop-blur-[2px] z-10 animate-out fade-out duration-300 pointer-events-none" />
        )}
      </div>

      {/* Top Video Status & Chapter Badge */}
      <div className="relative z-20 w-full p-3 sm:p-5 flex items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Live 4K Tag */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-amber-400/40 text-amber-300 text-xs font-black shadow-lg">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            <span className="w-2 h-2 rounded-full bg-rose-500 -mr-3"></span>
            <span className="font-mono text-[11px] text-amber-200 mr-1">{currentScene.badge}</span>
            <span className="text-[10px] text-slate-400">| مجلس النواب العراقي</span>
          </div>

          {/* Quick Scene Selector Buttons (Desktop/Tablet) */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md p-1 rounded-2xl border border-slate-800">
            {VIDEO_FEEDS.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectScene(i)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  i === currentSceneIndex
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {i === 0 ? '⚖️ المطرقة' : i === 1 ? '🏛️ المنصة' : '📜 القاعة الكبرى'}
              </button>
            ))}
          </div>
        </div>

        {/* Right Controls: Sidebar Collapse, Fullscreen */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Quick Strike Button */}
          <button
            type="button"
            disabled={isStriking}
            onClick={handleTriggerGavelStrike}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/25 active:scale-95 cursor-pointer transition-all disabled:opacity-50"
            title="طرق مطرقة رئاسة مجلس النواب العراقي"
          >
            <span>⚖️ طرق المطرقة</span>
          </button>

          {/* Fullscreen Video / Toggle Sidebar Button */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-slate-700/80 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-lg"
              title={isSidebarCollapsed ? 'إظهار بوابة الدخول' : 'عرض الفيديو بالكامل وإخفاء الجانب'}
            >
              {isSidebarCollapsed ? (
                <>
                  <Minimize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">بوابة الدخول ↵</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">ملء الشاشة 🎥</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Center Gavel Strike Interactive Target (Can tap anywhere to strike) */}
      <div 
        onClick={handleTriggerGavelStrike}
        className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 cursor-pointer text-center group"
        title="انقر في أي مكان لطرق مطرقة رئاسة المجلس وسماع الصوت الرسمي ⚖️"
      >
        {isStriking && (
          <div className="px-5 py-2.5 rounded-2xl bg-amber-950/90 border border-amber-400/80 text-amber-200 text-xs sm:text-sm font-black shadow-2xl animate-in zoom-in-95 duration-150 backdrop-blur-md">
            ⚖️ تم طرق مطرقة مجلس النواب العراقي - افتتاح الجلسة الرسمية
          </div>
        )}
      </div>

      {/* Bottom Professional 4K Video HUD Controller */}
      <div className="relative z-20 w-full p-2.5 sm:p-4 bg-gradient-to-t from-slate-950/95 via-slate-950/85 to-transparent">
        <div className="max-w-4xl mx-auto space-y-2">
          
          {/* Video Title & Time Display */}
          <div className="flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
              <span className="font-black text-amber-200 text-xs sm:text-sm truncate">
                {currentScene.title}
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline truncate">
                • {currentScene.subtitle}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-mono text-amber-300 bg-slate-900/90 px-2.5 py-0.5 rounded-lg border border-slate-800">
                {Math.floor((progress / 100) * currentScene.duration)}ث / {currentScene.duration}ث
              </span>

              {/* Sound Toggle */}
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-1.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                  soundEnabled 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}
                title={soundEnabled ? 'صوت المطرقة مفعل 🔊' : 'صوت المطرقة مكتوم 🔇'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Playback Speed */}
              <button
                type="button"
                onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 1.5 : 1)}
                className="px-2 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold cursor-pointer transition-colors"
                title="سرعة تشغيل الفيديو 4K"
              >
                {playbackSpeed}x
              </button>
            </div>
          </div>

          {/* Interactive Scrubbable Timeline Line */}
          <div 
            onClick={handleTimelineClick}
            className="group relative w-full bg-slate-800/90 h-2 sm:h-2.5 rounded-full overflow-hidden cursor-pointer hover:h-3 transition-all"
            title="انقر لتقديم أو تأخير الفيديو"
          >
            <div 
              className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 h-full transition-all duration-100 ease-linear rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Video Action Bar & Scene Switchers */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            {/* Play/Pause & Reset */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isPlaying ? 'إيقاف مؤقت' : 'تشغيل الفيديو'}</span>
              </button>

              <button
                type="button"
                onClick={() => setProgress(0)}
                className="p-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="إعادة تشغيل المشهد من البداية"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile Scene Selector Badges */}
            <div className="flex md:hidden items-center gap-1 text-[10px]">
              {VIDEO_FEEDS.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectScene(idx)}
                  className={`px-2 py-1 rounded-lg font-bold transition-all ${
                    idx === currentSceneIndex
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {idx === 0 ? 'المطرقة' : idx === 1 ? 'المنصة' : 'القاعة'}
                </button>
              ))}
            </div>

            {/* Hint message */}
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>فيديو 4K رسمي متجاوب بالكامل مع الحاسوب والهواتف</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
