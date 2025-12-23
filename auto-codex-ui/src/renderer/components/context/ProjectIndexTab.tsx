import { RefreshCw, AlertCircle, FolderTree } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import { ServiceCard } from './ServiceCard';
import { InfoItem } from './InfoItem';
import type { ProjectIndex } from '../../../shared/types';

interface ProjectIndexTabProps {
  projectIndex: ProjectIndex | null;
  indexLoading: boolean;
  indexError: string | null;
  onRefresh: () => void;
}

export function ProjectIndexTab({
  projectIndex,
  indexLoading,
  indexError,
  onRefresh
}: ProjectIndexTabProps) {
  const projectTypeLabels: Record<string, string> = {
    single: '单项目',
    monorepo: '多项目仓库',
    unknown: '未知'
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Header with refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">项目结构</h2>
            <p className="text-sm text-muted-foreground">
              AI 发现的代码库知识
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={indexLoading}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', indexLoading && 'animate-spin')} />
                刷新
              </Button>
            </TooltipTrigger>
            <TooltipContent>重新分析项目结构</TooltipContent>
          </Tooltip>
        </div>

        {/* Error state */}
        {indexError && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">加载项目索引失败</p>
              <p className="text-sm opacity-80">{indexError}</p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {indexLoading && !projectIndex && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* No index state */}
        {!indexLoading && !projectIndex && !indexError && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">未找到项目索引</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              点击刷新按钮以分析项目结构并创建索引。
            </p>
            <Button onClick={onRefresh} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              分析项目
            </Button>
          </div>
        )}

        {/* Project index content */}
        {projectIndex && (
          <div className="space-y-6">
            {/* Project Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">概览</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {projectTypeLabels[projectIndex.project_type] ?? projectIndex.project_type}
                  </Badge>
                  {Object.keys(projectIndex.services).length > 0 && (
                    <Badge variant="secondary">
                      {Object.keys(projectIndex.services).length} 个服务
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground font-mono truncate">
                  {projectIndex.project_root}
                </p>
              </CardContent>
            </Card>

            {/* Services */}
            {Object.keys(projectIndex.services).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  服务
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(projectIndex.services).map(([name, service]) => (
                    <ServiceCard key={name} name={name} service={service} />
                  ))}
                </div>
              </div>
            )}

            {/* Infrastructure */}
            {Object.keys(projectIndex.infrastructure).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  基础设施
                </h3>
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {projectIndex.infrastructure.docker_compose && (
                        <InfoItem label="Docker Compose" value={projectIndex.infrastructure.docker_compose} />
                      )}
                      {projectIndex.infrastructure.ci && (
                        <InfoItem label="CI/CD" value={projectIndex.infrastructure.ci} />
                      )}
                      {projectIndex.infrastructure.deployment && (
                        <InfoItem label="部署" value={projectIndex.infrastructure.deployment} />
                      )}
                      {projectIndex.infrastructure.docker_services &&
                        projectIndex.infrastructure.docker_services.length > 0 && (
                          <div className="sm:col-span-2">
                            <span className="text-xs text-muted-foreground">Docker 服务</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {projectIndex.infrastructure.docker_services.map((svc) => (
                                <Badge key={svc} variant="secondary" className="text-xs">
                                  {svc}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Conventions */}
            {Object.keys(projectIndex.conventions).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  约定
                </h3>
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {projectIndex.conventions.python_linting && (
                        <InfoItem label="Python 代码规范" value={projectIndex.conventions.python_linting} />
                      )}
                      {projectIndex.conventions.js_linting && (
                        <InfoItem label="JS 代码规范" value={projectIndex.conventions.js_linting} />
                      )}
                      {projectIndex.conventions.formatting && (
                        <InfoItem label="格式化" value={projectIndex.conventions.formatting} />
                      )}
                      {projectIndex.conventions.git_hooks && (
                        <InfoItem label="Git 钩子" value={projectIndex.conventions.git_hooks} />
                      )}
                      {projectIndex.conventions.typescript && (
                        <InfoItem label="TypeScript" value="已启用" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
