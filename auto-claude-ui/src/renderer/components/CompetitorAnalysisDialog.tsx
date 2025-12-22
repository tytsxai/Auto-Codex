import { Search, Globe, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from './ui/alert-dialog';

interface CompetitorAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
}

export function CompetitorAnalysisDialog({
  open,
  onOpenChange,
  onAccept,
  onDecline,
}: CompetitorAnalysisDialogProps) {
  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  const handleDecline = () => {
    onDecline();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground">
            <TrendingUp className="h-5 w-5 text-primary" />
            启用竞品分析？
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            通过竞品洞察增强你的路线图
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4 space-y-4">
          {/* What it does */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <h4 className="text-sm font-medium text-foreground mb-2">
              竞品分析将做什么：
            </h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <Search className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>根据你的项目类型识别 3-5 个主要竞争对手</span>
              </li>
              <li className="flex items-start gap-2">
                <Globe className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>
                  在应用商店、论坛和社交媒体中搜索用户反馈和痛点
                </span>
              </li>
              <li className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>
                  提出弥补竞品不足的功能建议
                </span>
              </li>
            </ul>
          </div>

          {/* Privacy notice */}
          <div className="rounded-lg bg-warning/10 border border-warning/30 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-foreground">
                  将进行网络搜索
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  此功能将通过网络搜索收集竞品信息。
                  你的项目名称和类型将用于搜索查询。
                  不共享代码或敏感数据。
                </p>
              </div>
            </div>
          </div>

          {/* Optional info */}
          <p className="text-xs text-muted-foreground">
            如果需要，你也可以在不进行竞品分析的情况下生成路线图。
            路线图仍将基于你的项目结构和最佳实践。
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDecline}>
            不，跳过分析
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleAccept}>
            是，启用分析
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
