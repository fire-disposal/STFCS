import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@/locales';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const currentLanguage = i18n.language;

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    document.documentElement.lang = lng;
    localStorage.setItem('i18nextLng', lng);
  };

  return (
    <div className="language-switcher">
      <Globe size={18} className="language-switcher-icon" />
      <select
        value={currentLanguage || 'en-US'}
        onChange={(e) => changeLanguage(e.target.value)}
        className="language-select"
        aria-label="Select language"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.flag} {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
};
