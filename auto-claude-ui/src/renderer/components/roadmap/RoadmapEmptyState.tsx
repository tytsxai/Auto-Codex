import { Map, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import type { RoadmapEmptyStateProps } from './types';

export function RoadmapEmptyState({ onGenerate }: RoadmapEmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <Card className="w-full max-w-lg p-8 text-center">
        <Map className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">暂无路线图</h2>
        <p className="text-muted-foreground mb-6">
          生成 AI 驱动的路线图，理解您项目的目标受众，并创建战略性的功能规划。
        </p>
        <Button onClick={onGenerate} size="lg">
          <Sparkles className="h-4 w-4 mr-2" />
          生成路线图
        </Button>
      </Card>
    </div>
  );
}
