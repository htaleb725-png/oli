import React from 'react';
import { LiveDriveGalleryWidget } from './LiveDriveGalleryWidget';

interface SmartImageArchiveModuleProps {
  onOpenCitizenHistory?: (citizenId: string) => void;
}

export const SmartImageArchiveModule: React.FC<SmartImageArchiveModuleProps> = () => {
  return (
    <div className="space-y-4 text-right font-['Tajawal',sans-serif]" dir="rtl">
      <LiveDriveGalleryWidget title="أرشيف البريد والصور الحي — مجلد Google Drive والبحث الموحد بالنظام" />
    </div>
  );
};
