import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import { AVAILABLE_MODELS, THINKING_LEVELS } from '../../shared/constants';
import type { InsightsModelConfig } from '../../shared/types';
import type { ModelType, ThinkingLevel } from '../../shared/types';

interface CustomModelModalProps {
  currentConfig?: InsightsModelConfig;
  onSave: (config: InsightsModelConfig) => void;
  onClose: () => void;
  open?: boolean;
}

export function CustomModelModal({ currentConfig, onSave, onClose, open = true }: CustomModelModalProps) {
  const [model, setModel] = useState<ModelType>(
    currentConfig?.model || 'codex'
  );
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(
    currentConfig?.thinkingLevel || 'medium'
  );

  // 模态框打开或配置变化时同步内部状态
  useEffect(() => {
    if (open) {
      setModel(currentConfig?.model || 'codex');
      setThinkingLevel(currentConfig?.thinkingLevel || 'medium');
    }
  }, [open, currentConfig]);

  const handleSave = () => {
    onSave({
      profileId: 'custom',
      model,
      thinkingLevel
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>自定义模型配置</DialogTitle>
          <DialogDescription>
            配置此聊天会话的模型和思考等级。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="model-select">模型</Label>
            <Select value={model} onValueChange={(v) => setModel(v as ModelType)}>
              <SelectTrigger id="model-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="thinking-select">思考等级</Label>
            <Select value={thinkingLevel} onValueChange={(v) => setThinkingLevel(v as ThinkingLevel)}>
              <SelectTrigger id="thinking-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THINKING_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{level.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {level.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>
            应用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
