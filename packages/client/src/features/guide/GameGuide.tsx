/**
 * 玩家引导提示系统
 *
 * 提供游戏各阶段的引导提示：
 * - 阶段引导
 * - 操作提示
 * - 错误提示
 * - 状态提示
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GamePhase, TurnPhase } from '@vt/shared/protocol';
import type { FactionId } from '@vt/shared/types';
import {
  Info,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
  Target,
  Sword,
  Shield,
  Move,
  Users,
} from 'lucide-react';

// ==================== 引导步骤定义 ====================

/**
 * 引导步骤
 */
export interface GuideStep {
  id: string;
  title: string;
  description: string;
  targetElement?: string;
  action?: 'click' | 'drag' | 'select' | 'hover';
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlight?: boolean;
  required?: boolean;
}

/**
 * 阶段引导配置
 */
export interface PhaseGuideConfig {
  phase: GamePhase | TurnPhase;
  title: string;
  description: string;
  steps: GuideStep[];
  autoShow?: boolean;
  showOnce?: boolean;
}

// 大厅阶段引导
const lobbyGuide: PhaseGuideConfig = {
  phase: 'lobby',
  title: '欢迎来到 STFCS',
  description: '星际战术指挥系统 - 多人太空战棋游戏',
  autoShow: true,
  showOnce: true,
  steps: [
    {
      id: 'lobby_name',
      title: '设置名称',
      description: '在右上角输入你的玩家名称，这将显示给其他玩家',
      position: 'bottom',
    },
    {
      id: 'lobby_create',
      title: '创建房间',
      description: '点击"创建房间"按钮开始新游戏，或加入已有房间',
      position: 'bottom',
    },
    {
      id: 'lobby_join',
      title: '加入房间',
      description: '浏览房间列表，选择一个房间加入游戏',
      position: 'top',
    },
  ],
};

// 部署阶段引导
const deploymentGuide: PhaseGuideConfig = {
  phase: 'deployment',
  title: '部署阶段',
  description: '在战斗开始前部署你的舰队',
  autoShow: true,
  showOnce: true,
  steps: [
    {
      id: 'deploy_zone',
      title: '部署区域',
      description: '高亮显示的区域是你的部署区域，舰船必须放置在此区域内',
      position: 'center',
      highlight: true,
    },
    {
      id: 'deploy_select',
      title: '选择舰船',
      description: '从左侧面板选择要部署的舰船',
      position: 'right',
    },
    {
      id: 'deploy_place',
      title: '放置舰船',
      description: '点击地图上的位置放置舰船',
      action: 'click',
      position: 'center',
    },
    {
      id: 'deploy_rotate',
      title: '调整朝向',
      description: '使用 Q/E 键或滚轮调整舰船朝向',
      position: 'bottom',
    },
    {
      id: 'deploy_confirm',
      title: '确认部署',
      description: '放置完成后点击"确认部署"按钮',
      position: 'top',
    },
    {
      id: 'deploy_ready',
      title: '准备就绪',
      description: '所有舰船部署完成后，点击"就绪"按钮等待其他玩家',
      position: 'top',
    },
  ],
};

// 玩家行动阶段引导
const playerActionGuide: PhaseGuideConfig = {
  phase: 'player_action',
  title: '玩家行动阶段',
  description: '控制你的舰队进行战斗',
  autoShow: true,
  showOnce: true,
  steps: [
    {
      id: 'action_select',
      title: '选择舰船',
      description: '点击选择你要控制的舰船',
      action: 'click',
      position: 'center',
    },
    {
      id: 'action_move',
      title: '移动舰船',
      description: '使用 W/A/S/D 键或拖拽移动舰船（三阶段移动）',
      position: 'bottom',
    },
    {
      id: 'action_attack',
      title: '攻击敌人',
      description: '选择武器和目标进行攻击',
      position: 'bottom',
    },
    {
      id: 'action_shield',
      title: '护盾控制',
      description: '按 F 键切换护盾开关',
      position: 'bottom',
    },
    {
      id: 'action_vent',
      title: '散热',
      description: '按 V 键开始主动散热（本回合无法行动）',
      position: 'bottom',
    },
    {
      id: 'action_end',
      title: '结束回合',
      description: '完成所有行动后点击"结束回合"按钮',
      position: 'top',
    },
  ],
};

// DM行动阶段引导
const dmActionGuide: PhaseGuideConfig = {
  phase: 'dm_action',
  title: 'DM行动阶段',
  description: '控制敌方单位行动',
  autoShow: true,
  showOnce: true,
  steps: [
    {
      id: 'dm_select',
      title: '选择敌方单位',
      description: '点击选择要控制的敌方舰船',
      position: 'center',
    },
    {
      id: 'dm_control',
      title: '控制面板',
      description: '使用右侧DM控制面板管理敌方单位',
      position: 'left',
    },
    {
      id: 'dm_advance',
      title: '推进阶段',
      description: '完成敌方行动后点击"推进阶段"进入结算',
      position: 'bottom',
    },
  ],
};

// 结算阶段引导
const resolutionGuide: PhaseGuideConfig = {
  phase: 'resolution',
  title: '回合结算',
  description: '处理回合结束时的各种效果',
  autoShow: true,
  showOnce: true,
  steps: [
    {
      id: 'resolution_flux',
      title: '辐能消散',
      description: '舰船的软辐能会自动消散',
      position: 'center',
    },
    {
      id: 'resolution_overload',
      title: '过载恢复',
      description: '过载的舰船将在结算后恢复',
      position: 'center',
    },
    {
      id: 'resolution_next',
      title: '下一回合',
      description: '结算完成后自动进入下一回合',
      position: 'top',
    },
  ],
};

// 所有阶段引导配置
const phaseGuides: Record<string, PhaseGuideConfig> = {
  lobby: lobbyGuide,
  deployment: deploymentGuide,
  player_action: playerActionGuide,
  dm_action: dmActionGuide,
  resolution: resolutionGuide,
};

// ==================== 引导提示组件 ====================

// 样式
const styles = {
  container: {
    position: 'fixed' as const,
    zIndex: 1000,
    pointerEvents: 'none' as const,
  },
  tooltip: {
    maxWidth: '320px',
    padding: '16px',
    backgroundColor: 'rgba(15, 18, 25, 0.95)',
    borderRadius: '12px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    pointerEvents: 'auto' as const,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'rgba(74, 158, 255, 1)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  closeButton: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'rgba(255, 255, 255, 0.5)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  description: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: '1.5',
    marginBottom: '12px',
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    marginBottom: '12px',
  },
  stepDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    transition: 'all 0.2s ease',
  },
  stepDotActive: {
    backgroundColor: 'rgba(74, 158, 255, 1)',
    transform: 'scale(1.2)',
  },
  stepDotComplete: {
    backgroundColor: 'rgba(34, 197, 94, 1)',
  },
  stepDotPending: {
    backgroundColor: 'rgba(100, 116, 139, 0.5)',
  },
  buttons: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
  },
  button: {
    flex: 1,
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    color: 'rgba(74, 158, 255, 1)',
    fontSize: '12px',
    fontWeight: 'medium',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    transition: 'all 0.2s ease',
  },
  buttonPrimary: {
    backgroundColor: 'rgba(74, 158, 255, 0.3)',
    borderColor: 'rgba(74, 158, 255, 0.5)',
  },
  highlight: {
    position: 'fixed' as const,
    pointerEvents: 'none' as const,
    borderRadius: '8px',
    boxShadow: '0 0 0 4px rgba(74, 158, 255, 0.5)',
    transition: 'all 0.3s ease',
  },
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    pointerEvents: 'none' as const,
  },
};

interface GuideTooltipProps {
  step: GuideStep;
  currentStep: number;
  totalSteps: number;
  position: { x: number; y: number };
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onClose: () => void;
}

const GuideTooltip: React.FC<GuideTooltipProps> = ({
  step,
  currentStep,
  totalSteps,
  position,
  onNext,
  onPrev,
  onSkip,
  onClose,
}) => {
  const isLastStep = currentStep >= totalSteps - 1;
  const isFirstStep = currentStep <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{
        ...styles.container,
        left: position.x,
        top: position.y,
      }}
    >
      <div style={styles.tooltip}>
        <div style={styles.header}>
          <span style={styles.title}>
            <Lightbulb size={14} />
            {step.title}
          </span>
          <button style={styles.closeButton} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <p style={styles.description}>{step.description}</p>

        {/* 步骤指示器 */}
        <div style={styles.stepIndicator}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.stepDot,
                ...(i === currentStep ? styles.stepDotActive : {}),
                ...(i < currentStep ? styles.stepDotComplete : {}),
                ...(i > currentStep ? styles.stepDotPending : {}),
              }}
            />
          ))}
        </div>

        {/* 按钮 */}
        <div style={styles.buttons}>
          {!isFirstStep && (
            <button style={styles.button} onClick={onPrev}>
              <ChevronLeft size={14} />
              上一步
            </button>
          )}
          <button style={styles.button} onClick={onSkip}>
            跳过
          </button>
          <button
            style={{ ...styles.button, ...styles.buttonPrimary }}
            onClick={isLastStep ? onClose : onNext}
          >
            {isLastStep ? '完成' : '下一步'}
            {!isLastStep && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ==================== 引导管理器 ====================

/**
 * 引导管理器配置
 */
export interface GuideManagerConfig {
  onGuideStart?: (phase: string) => void;
  onGuideComplete?: (phase: string) => void;
  onGuideSkip?: (phase: string, step: number) => void;
}

/**
 * 引导管理器
 */
export class GuideManager {
  private config: GuideManagerConfig;
  private completedGuides: Set<string> = new Set();
  private currentPhase: string | null = null;
  private currentStep: number = 0;

  constructor(config: GuideManagerConfig = {}) {
    this.config = config;
    this.loadCompletedGuides();
  }

  /**
   * 获取阶段引导配置
   */
  getPhaseGuide(phase: string): PhaseGuideConfig | null {
    return phaseGuides[phase] || null;
  }

  /**
   * 检查引导是否已完成
   */
  isGuideCompleted(phase: string): boolean {
    return this.completedGuides.has(phase);
  }

  /**
   * 开始阶段引导
   */
  startGuide(phase: string): GuideStep | null {
    const guide = this.getPhaseGuide(phase);
    if (!guide) return null;

    // 如果只显示一次且已完成，跳过
    if (guide.showOnce && this.isGuideCompleted(phase)) {
      return null;
    }

    this.currentPhase = phase;
    this.currentStep = 0;
    this.config.onGuideStart?.(phase);

    return guide.steps[0];
  }

  /**
   * 获取当前步骤
   */
  getCurrentStep(): { step: GuideStep; index: number; total: number } | null {
    if (!this.currentPhase) return null;

    const guide = this.getPhaseGuide(this.currentPhase);
    if (!guide) return null;

    return {
      step: guide.steps[this.currentStep],
      index: this.currentStep,
      total: guide.steps.length,
    };
  }

  /**
   * 下一步
   */
  nextStep(): GuideStep | null {
    if (!this.currentPhase) return null;

    const guide = this.getPhaseGuide(this.currentPhase);
    if (!guide) return null;

    if (this.currentStep >= guide.steps.length - 1) {
      this.completeGuide();
      return null;
    }

    this.currentStep++;
    return guide.steps[this.currentStep];
  }

  /**
   * 上一步
   */
  prevStep(): GuideStep | null {
    if (!this.currentPhase) return null;

    if (this.currentStep <= 0) {
      return null;
    }

    this.currentStep--;
    const guide = this.getPhaseGuide(this.currentPhase);
    return guide?.steps[this.currentStep] || null;
  }

  /**
   * 跳过引导
   */
  skipGuide(): void {
    if (!this.currentPhase) return;

    this.config.onGuideSkip?.(this.currentPhase, this.currentStep);
    this.completeGuide();
  }

  /**
   * 完成引导
   */
  completeGuide(): void {
    if (!this.currentPhase) return;

    this.completedGuides.add(this.currentPhase);
    this.saveCompletedGuides();
    this.config.onGuideComplete?.(this.currentPhase);

    this.currentPhase = null;
    this.currentStep = 0;
  }

  /**
   * 重置引导
   */
  resetGuide(phase?: string): void {
    if (phase) {
      this.completedGuides.delete(phase);
    } else {
      this.completedGuides.clear();
    }
    this.saveCompletedGuides();
  }

  /**
   * 加载已完成的引导
   */
  private loadCompletedGuides(): void {
    try {
      const saved = localStorage.getItem('stfcs_completed_guides');
      if (saved) {
        this.completedGuides = new Set(JSON.parse(saved));
      }
    } catch {
      // 忽略错误
    }
  }

  /**
   * 保存已完成的引导
   */
  private saveCompletedGuides(): void {
    try {
      localStorage.setItem(
        'stfcs_completed_guides',
        JSON.stringify([...this.completedGuides])
      );
    } catch {
      // 忽略错误
    }
  }
}

// ==================== 引导组件 ====================

interface GameGuideProps {
  phase: GamePhase | TurnPhase;
  guideManager: GuideManager;
  targetElement?: string;
}

export const GameGuide: React.FC<GameGuideProps> = ({
  phase,
  guideManager,
  targetElement,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStepData, setCurrentStepData] = useState<{
    step: GuideStep;
    index: number;
    total: number;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // 开始引导
  useEffect(() => {
    const step = guideManager.startGuide(phase);
    if (step) {
      setCurrentStepData({
        step,
        index: 0,
        total: guideManager.getPhaseGuide(phase)?.steps.length || 1,
      });
      setIsVisible(true);
      updateTooltipPosition(step);
    }
  }, [phase, guideManager]);

  // 更新提示位置
  const updateTooltipPosition = useCallback((step: GuideStep) => {
    // 默认居中
    let x = window.innerWidth / 2 - 160;
    let y = window.innerHeight / 2 - 100;

    // 如果有目标元素，计算位置
    if (step.targetElement) {
      const element = document.querySelector(step.targetElement);
      if (element) {
        const rect = element.getBoundingClientRect();
        switch (step.position) {
          case 'top':
            x = rect.left + rect.width / 2 - 160;
            y = rect.top - 150;
            break;
          case 'bottom':
            x = rect.left + rect.width / 2 - 160;
            y = rect.bottom + 20;
            break;
          case 'left':
            x = rect.left - 340;
            y = rect.top + rect.height / 2 - 50;
            break;
          case 'right':
            x = rect.right + 20;
            y = rect.top + rect.height / 2 - 50;
            break;
        }
      }
    }

    // 确保在屏幕内
    x = Math.max(20, Math.min(x, window.innerWidth - 340));
    y = Math.max(20, Math.min(y, window.innerHeight - 200));

    setTooltipPosition({ x, y });
  }, []);

  // 处理下一步
  const handleNext = useCallback(() => {
    const step = guideManager.nextStep();
    if (step) {
      const guide = guideManager.getPhaseGuide(phase);
      setCurrentStepData({
        step,
        index: guideManager.getCurrentStep()?.index || 0,
        total: guide?.steps.length || 1,
      });
      updateTooltipPosition(step);
    } else {
      setIsVisible(false);
    }
  }, [guideManager, phase, updateTooltipPosition]);

  // 处理上一步
  const handlePrev = useCallback(() => {
    const step = guideManager.prevStep();
    if (step) {
      const guide = guideManager.getPhaseGuide(phase);
      setCurrentStepData({
        step,
        index: guideManager.getCurrentStep()?.index || 0,
        total: guide?.steps.length || 1,
      });
      updateTooltipPosition(step);
    }
  }, [guideManager, phase, updateTooltipPosition]);

  // 处理跳过
  const handleSkip = useCallback(() => {
    guideManager.skipGuide();
    setIsVisible(false);
  }, [guideManager]);

  // 处理关闭
  const handleClose = useCallback(() => {
    guideManager.completeGuide();
    setIsVisible(false);
  }, [guideManager]);

  if (!isVisible || !currentStepData) return null;

  return (
    <AnimatePresence>
      {/* 高亮遮罩 */}
      {currentStepData.step.highlight && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={styles.overlay}
        />
      )}

      {/* 提示框 */}
      <GuideTooltip
        step={currentStepData.step}
        currentStep={currentStepData.index}
        totalSteps={currentStepData.total}
        position={tooltipPosition}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
        onClose={handleClose}
      />
    </AnimatePresence>
  );
};

export default GameGuide;