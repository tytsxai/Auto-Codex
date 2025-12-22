import { FolderOpen, FolderPlus, Clock, ChevronRight, Folder } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import type { Project } from '../../shared/types';

interface WelcomeScreenProps {
  projects: Project[];
  onNewProject: () => void;
  onOpenProject: () => void;
  onSelectProject: (projectId: string) => void;
}

export function WelcomeScreen({
  projects,
  onNewProject,
  onOpenProject,
  onSelectProject
}: WelcomeScreenProps) {
  // 按 updatedAt 排序项目（最新在前）
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* 首屏区域 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            欢迎使用 Auto Claude
          </h1>
          <p className="mt-3 text-muted-foreground">
            使用 AI 智能体自主构建软件
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-4 justify-center mb-10">
          <Button
            size="lg"
            onClick={onNewProject}
            className="gap-2 px-6"
          >
            <FolderPlus className="h-5 w-5" />
            新建项目
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={onOpenProject}
            className="gap-2 px-6"
          >
            <FolderOpen className="h-5 w-5" />
            打开项目
          </Button>
        </div>

        {/* 最近项目区域 */}
        {recentProjects.length > 0 && (
          <Card className="border border-border bg-card/50 backdrop-blur-sm">
            <div className="p-4 pb-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                最近项目
              </div>
            </div>
            <Separator />
            <ScrollArea className="max-h-[320px]">
              <div className="p-2">
                {recentProjects.map((project, _index) => (
                  <button
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent/50 group"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground shrink-0">
                      <Folder className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {project.name}
                        </span>
                        {project.autoBuildPath && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/20 text-success shrink-0">
                            已初始化
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {project.path}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(project.updatedAt)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}

        {/* 无项目时的空状态 */}
        {projects.length === 0 && (
          <Card className="border border-dashed border-border bg-card/30 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 mx-auto mb-4">
              <Folder className="h-6 w-6 text-accent-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">暂无项目</h3>
            <p className="text-sm text-muted-foreground mb-4">
              创建新项目或打开现有项目以开始使用
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
