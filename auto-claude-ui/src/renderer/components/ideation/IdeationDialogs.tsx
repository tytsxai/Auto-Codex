import { CheckCircle2, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog';
import {
  IDEATION_TYPE_LABELS,
  IDEATION_TYPE_DESCRIPTIONS,
  IDEATION_TYPE_COLORS
} from '../../../shared/constants';
import type { IdeationType, IdeationConfig } from '../../../shared/types';
import { TypeIcon } from './TypeIcon';
import { ALL_IDEATION_TYPES } from './constants';

const IDEATION_TYPE_LABELS_ZH: Record<string, string> = {
  code_improvements: '代码改进',
  ui_ux_improvements: 'UI/UX 改进',
  documentation_gaps: '文档',
  security_hardening: '安全加固',
  performance_optimizations: '性能优化',
  code_quality: '代码质量'
};

const IDEATION_TYPE_DESCRIPTIONS_ZH: Record<string, string> = {
  code_improvements: '基于模式、架构与基础设施分析发现的代码机会',
  ui_ux_improvements: '通过应用分析识别的视觉与交互改进',
  documentation_gaps: '需要补充或更新的文档缺口',
  security_hardening: '安全漏洞与加固机会',
  performance_optimizations: '性能瓶颈与优化机会',
  code_quality: '重构机会、大文件、代码异味与最佳实践违规'
};

interface IdeationDialogsProps {
  showConfigDialog: boolean;
  showAddMoreDialog: boolean;
  config: IdeationConfig;
  typesToAdd: IdeationType[];
  availableTypesToAdd: IdeationType[];
  onToggleIdeationType: (type: IdeationType) => void;
  onToggleTypeToAdd: (type: IdeationType) => void;
  onSetConfig: (config: Partial<IdeationConfig>) => void;
  onCloseConfigDialog: () => void;
  onCloseAddMoreDialog: () => void;
  onConfirmAddMore: () => void;
}

export function IdeationDialogs({
  showConfigDialog,
  showAddMoreDialog,
  config,
  typesToAdd,
  availableTypesToAdd,
  onToggleIdeationType,
  onToggleTypeToAdd,
  onSetConfig,
  onCloseConfigDialog,
  onCloseAddMoreDialog,
  onConfirmAddMore
}: IdeationDialogsProps) {
  return (
    <>
      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={onCloseConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创意配置</DialogTitle>
            <DialogDescription>
              配置要生成的想法类型
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-96 overflow-y-auto">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">创意类型</h4>
              {ALL_IDEATION_TYPES.map((type) => (
                <div
                  key={type}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${IDEATION_TYPE_COLORS[type]}`}>
                      <TypeIcon type={type} />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {IDEATION_TYPE_LABELS_ZH[type] ?? IDEATION_TYPE_LABELS[type]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {IDEATION_TYPE_DESCRIPTIONS_ZH[type] ?? IDEATION_TYPE_DESCRIPTIONS[type]}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={config.enabledTypes.includes(type)}
                    onCheckedChange={() => onToggleIdeationType(type)}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">上下文来源</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm">包含路线图上下文</span>
                <Switch
                  checked={config.includeRoadmapContext}
                  onCheckedChange={(checked) => onSetConfig({ includeRoadmapContext: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">包含看板上下文</span>
                <Switch
                  checked={config.includeKanbanContext}
                  onCheckedChange={(checked) => onSetConfig({ includeKanbanContext: checked })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseConfigDialog}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add More Ideas Dialog */}
      <Dialog open={showAddMoreDialog} onOpenChange={onCloseAddMoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加更多想法</DialogTitle>
            <DialogDescription>
              选择额外的创意类型以生成。现有想法将被保留。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-96 overflow-y-auto">
            {availableTypesToAdd.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-success" />
                <p>你已生成所有创意类型！</p>
                <p className="text-sm mt-1">使用“重新生成”以刷新现有想法。</p>
              </div>
            ) : (
              availableTypesToAdd.map((type) => (
                <div
                  key={type}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    typesToAdd.includes(type)
                      ? 'bg-primary/10 border border-primary'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                  onClick={() => onToggleTypeToAdd(type)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${IDEATION_TYPE_COLORS[type]}`}>
                      <TypeIcon type={type} />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {IDEATION_TYPE_LABELS_ZH[type] ?? IDEATION_TYPE_LABELS[type]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {IDEATION_TYPE_DESCRIPTIONS_ZH[type] ?? IDEATION_TYPE_DESCRIPTIONS[type]}
                      </div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    typesToAdd.includes(type)
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  }`}>
                    {typesToAdd.includes(type) && (
                      <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {typesToAdd.length > 0 && `${typesToAdd.length} 已选择`}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCloseAddMoreDialog}>
                取消
              </Button>
              <Button
                onClick={onConfirmAddMore}
                disabled={typesToAdd.length === 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                生成 {typesToAdd.length > 0 ? `${typesToAdd.length} 种类型` : '想法'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
