import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './zh-CN/translation.json';
import enUS from './en-US/translation.json';

export const resources = {
  'zh-CN': {
    translation: zhCN,
  },
  'en-US': {
    translation: enUS,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en-US',
    debug: import.meta.env.DEV,
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    
    interpolation: {
      escapeValue: false,
    },
    
    react: {
      useSuspense: false,
    },
  });

export default i18n;

export type AppLanguage = 'zh-CN' | 'en-US';
export const SUPPORTED_LANGUAGES = [
  { value: 'zh-CN' as AppLanguage, label: '简体中文', flag: '🇨🇳' },
  { value: 'en-US' as AppLanguage, label: 'English', flag: '🇺🇸' },
];
