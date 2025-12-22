/**
 * 模型与代理配置常量
 * Codex 模型、思考级别、记忆后端和代理配置
 */

import type { AgentProfile, PhaseModelConfig, FeatureModelConfig, FeatureThinkingConfig } from '../types/settings';

// ============================================
// 可用模型
// ============================================

export const AVAILABLE_MODELS = [
  { value: 'codex', label: 'gpt-5.2-codex-xhigh' }
] as const;

// 将模型简称映射到实际 Codex 模型 ID
export const MODEL_ID_MAP: Record<string, string> = {
  codex: 'gpt-5.2-codex-xhigh'
} as const;

// 将思考级别映射到预算 token（null 表示不启用扩展思考）
export const THINKING_BUDGET_MAP: Record<string, number | null> = {
  none: null,
  low: 1024,
  medium: 4096,
  high: 16384,
  ultrathink: 65536
} as const;

// ============================================
// 思考级别
// ============================================

// Codex 模型的思考级别（预算 token 分配）
export const THINKING_LEVELS = [
  { value: 'none', label: 'None', description: 'No extended thinking' },
  { value: 'low', label: 'Low', description: 'Brief consideration' },
  { value: 'medium', label: 'Medium', description: 'Moderate analysis' },
  { value: 'high', label: 'High', description: 'Deep thinking' },
  { value: 'ultrathink', label: 'Ultra Think', description: 'Maximum reasoning depth' }
] as const;

// ============================================
// 代理配置
// ============================================

// Auto 配置的默认阶段模型设置
// 所有阶段使用 Codex 以获得最高质量
export const DEFAULT_PHASE_MODELS: PhaseModelConfig = {
  spec: 'codex',
  planning: 'codex',
  coding: 'codex',
  qa: 'codex'
};

// Auto 配置的默认阶段思考设置
export const DEFAULT_PHASE_THINKING: import('../types/settings').PhaseThinkingConfig = {
  spec: 'ultrathink',   // 深度思考以创建全面的规范
  planning: 'high',     // 规划复杂功能所需的高强度思考
  coding: 'low',        // 更快的编码迭代
  qa: 'low'             // 高效 QA 审核
};

// ============================================
// 功能设置（非流水线功能）
// ============================================

// 默认功能模型配置（用于洞察、创意、路线图）
export const DEFAULT_FEATURE_MODELS: FeatureModelConfig = {
  insights: 'codex',
  ideation: 'codex',
  roadmap: 'codex'
};

// 默认功能思考配置
export const DEFAULT_FEATURE_THINKING: FeatureThinkingConfig = {
  insights: 'medium',   // 对话所需的平衡思考
  ideation: 'high',     // 创意想法需要深度思考
  roadmap: 'high'       // 路线图需要战略性思考
};

// UI 展示的功能标签
export const FEATURE_LABELS: Record<keyof FeatureModelConfig, { label: string; description: string }> = {
  insights: { label: '洞察对话', description: '就你的代码库提出问题' },
  ideation: { label: '创意', description: '生成特性想法和改进' },
  roadmap: { label: '路线图', description: '创建战略性功能路线图' }
};

// 预设模型/思考配置的默认代理配置
export const DEFAULT_AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'auto',
    name: 'Auto (Optimized)',
    description: 'Uses Codex across all phases with optimized thinking levels',
    model: 'codex',  // 回退/默认模型
    thinkingLevel: 'high',
    icon: 'Sparkles',
    isAutoProfile: true,
    phaseModels: DEFAULT_PHASE_MODELS,
    phaseThinking: DEFAULT_PHASE_THINKING
  },
  {
    id: 'complex',
    name: 'Complex Tasks',
    description: 'For intricate, multi-step implementations requiring deep analysis',
    model: 'codex',
    thinkingLevel: 'ultrathink',
    icon: 'Brain'
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Good balance of speed and quality for most tasks',
    model: 'codex',
    thinkingLevel: 'medium',
    icon: 'Scale'
  },
  {
    id: 'quick',
    name: 'Quick Edits',
    description: 'Fast iterations for simple changes and quick fixes',
    model: 'codex',
    thinkingLevel: 'low',
    icon: 'Zap'
  }
];

// ============================================
// 记忆后端
// ============================================

export const MEMORY_BACKENDS = [
  { value: 'file', label: 'File-based (default)' },
  { value: 'graphiti', label: 'Graphiti (FalkorDB)' }
] as const;
