import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export const SciFiLanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language || 'en-US';

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    document.documentElement.lang = lng;
    localStorage.setItem('i18nextLng', lng);
  };

  const isChinese = currentLanguage === 'zh-CN';

  return (
    <div className="scifi-language-switcher">
      <div className="scifi-switch-track">
        {/* 左侧中文标签 */}
        <button
          className={`scifi-switch-label ${isChinese ? 'active' : ''}`}
          onClick={() => changeLanguage('zh-CN')}
          type="button"
        >
          <span className="label-text">中</span>
        </button>

        {/* 胶囊滑块 */}
        <motion.div
          className="scifi-switch-capsule"
          animate={{ left: isChinese ? '2px' : 'calc(50% + 2px)' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />

        {/* 右侧英文标签 */}
        <button
          className={`scifi-switch-label ${!isChinese ? 'active' : ''}`}
          onClick={() => changeLanguage('en-US')}
          type="button"
        >
          <span className="label-text">EN</span>
        </button>
      </div>
    </div>
  );
};
