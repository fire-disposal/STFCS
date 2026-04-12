/**
 * 磁性吸附指针组件 - 战术终端风格
 * 
 * 四个角为 L 型线条，无阴影，优化过渡动画
 */

import React, { useEffect, useRef, useCallback } from 'react';

/**
 * 磁性指针容器 - 包裹整个应用
 */
export const MagneticPointerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pointerRef = useRef<HTMLDivElement>(null);
  const currentTargetRef = useRef<HTMLElement | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ width: 4, height: 4 });

  const resetPointerState = useCallback(() => {
    currentTargetRef.current = null;
    sizeRef.current = { width: 4, height: 4 };

    if (pointerRef.current) {
      pointerRef.current.style.width = '4px';
      pointerRef.current.style.height = '4px';
      pointerRef.current.style.top = '-2px';
      pointerRef.current.style.left = '-2px';
    }
  }, []);

  // 鼠标移动处理
  const handleMouseMove = useCallback((e: MouseEvent) => {
    mousePos.current = { x: e.clientX, y: e.clientY };
    
    if (pointerRef.current) {
      let x = e.clientX;
      let y = e.clientY;
      
      // 磁性吸附效果
      if (currentTargetRef.current) {
        if (!currentTargetRef.current.isConnected) {
          resetPointerState();
        } else {
          const rect = currentTargetRef.current.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          x = centerX + (x - centerX) * 0.1;
          y = centerY + (y - centerY) * 0.1;
        }
      }
      
      // 使用 style.setProperty 确保样式被正确应用
      pointerRef.current.style.transform = `translate(${x}px, ${y}px)`;
      pointerRef.current.style.display = 'block';
    }
  }, [resetPointerState]);

  // 鼠标进入目标元素
  const handleMouseEnter = useCallback((e: Event) => {
    const target = e.currentTarget as HTMLElement;
    if (!target) return;

    currentTargetRef.current = target;
    const rect = target.getBoundingClientRect();
    
    // 根据目标尺寸调整指针大小
    const padding = Math.min(window.innerWidth / 50, 40);
    sizeRef.current = {
      width: rect.width + padding,
      height: rect.height + padding,
    };
    
    if (pointerRef.current) {
      pointerRef.current.style.width = `${sizeRef.current.width}px`;
      pointerRef.current.style.height = `${sizeRef.current.height}px`;
      pointerRef.current.style.top = `calc(${sizeRef.current.height}px / -2)`;
      pointerRef.current.style.left = `calc(${sizeRef.current.width}px / -2)`;
    }
  }, []);

  // 鼠标离开目标元素
  const handleMouseLeave = useCallback(() => {
    resetPointerState();
  }, [resetPointerState]);

  // 绑定事件
  useEffect(() => {
    const bindEvents = () => {
      const elements = document.querySelectorAll('[data-magnetic]');
      
      elements.forEach(el => {
        if ((el as HTMLElement).dataset.magneticBound) return;
        
        el.addEventListener('mouseenter', handleMouseEnter as EventListener);
        el.addEventListener('mouseleave', handleMouseLeave as EventListener);
        (el as HTMLElement).dataset.magneticBound = 'true';
      });
    };

    bindEvents();

    const observer = new MutationObserver(bindEvents);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      observer.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      resetPointerState();
    };
  }, [handleMouseEnter, handleMouseLeave, handleMouseMove, resetPointerState]);

  return (
    <>
      {/* 磁性指针 */}
      <div
        ref={pointerRef}
        style={{
          position: 'fixed',
          top: '-2px',
          left: '-2px',
          width: '4px',
          height: '4px',
          pointerEvents: 'none',
          zIndex: 100000,
          transition: 'width 0.2s ease-out, height 0.2s ease-out, top 0.2s ease-out, left 0.2s ease-out',
        }}
      >
        {/* 四个角 - L 型线条，无阴影 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '12px',
            height: '12px',
            borderLeft: '2px solid #4a9eff',
            borderTop: '2px solid #4a9eff',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '12px',
            height: '12px',
            borderRight: '2px solid #4a9eff',
            borderTop: '2px solid #4a9eff',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '12px',
            height: '12px',
            borderLeft: '2px solid #4a9eff',
            borderBottom: '2px solid #4a9eff',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '12px',
            height: '12px',
            borderRight: '2px solid #4a9eff',
            borderBottom: '2px solid #4a9eff',
          }}
        />
      </div>

      {/* 全局样式 */}
      <style>{`
        [data-magnetic] {
          cursor: none !important;
        }
        
        [data-magnetic]:disabled,
        [data-magnetic][aria-disabled="true"] {
          cursor: not-allowed !important;
        }
      `}</style>

      {children}
    </>
  );
};

/**
 * 磁性目标组件
 */
interface MagneticTargetProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
}

export const MagneticTarget: React.FC<MagneticTargetProps> = ({
  children,
  className = '',
  style = {},
  onClick,
  disabled = false,
}) => {
  return (
    <div
      data-magnetic
      data-magnetic-bound="true"
      className={className}
      style={style}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
    >
      {children}
    </div>
  );
};

export default MagneticPointerProvider;
