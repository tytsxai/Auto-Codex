import { useState } from 'react';
import {
  RefreshCw,
  Database,
  Brain,
  Search,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import { MemoryCard } from './MemoryCard';
import { InfoItem } from './InfoItem';
import type { GraphitiMemoryStatus, GraphitiMemoryState, MemoryEpisode } from '../../../shared/types';

interface MemoriesTabProps {
  memoryStatus: GraphitiMemoryStatus | null;
  memoryState: GraphitiMemoryState | null;
  recentMemories: MemoryEpisode[];
  memoriesLoading: boolean;
  searchResults: Array<{ type: string; content: string; score: number }>;
  searchLoading: boolean;
  onSearch: (query: string) => void;
}

export function MemoriesTab({
  memoryStatus,
  memoryState,
  recentMemories,
  memoriesLoading,
  searchResults,
  searchLoading,
  onSearch
}: MemoriesTabProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  const handleSearch = () => {
    if (localSearchQuery.trim()) {
      onSearch(localSearchQuery);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Memory Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                图记忆状态
              </CardTitle>
              {memoryStatus?.available ? (
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  已连接
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  <XCircle className="h-3 w-3 mr-1" />
                  不可用
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {memoryStatus?.available ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <InfoItem label="数据库" value={memoryStatus.database || 'auto_claude_memory'} />
                  <InfoItem label="主机" value={`${memoryStatus.host}:${memoryStatus.port}`} />
                  {memoryState && (
                    <InfoItem label="片段数" value={memoryState.episode_count.toString()} />
                  )}
                </div>
                {memoryState?.last_session && (
                  <p className="text-xs text-muted-foreground">
                    最近会话：#{memoryState.last_session}
                  </p>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p>{memoryStatus?.reason || 'Graphiti 记忆尚未配置'}</p>
                <p className="mt-2 text-xs">
                  要启用图记忆，请设置 <code className="bg-muted px-1 py-0.5 rounded">GRAPHITI_ENABLED=true</code> 并配置 FalkorDB。
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            搜索记忆
          </h3>
          <div className="flex gap-2">
            <Input
              placeholder="搜索模式、洞察、坑点..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <Button onClick={handleSearch} disabled={searchLoading}>
              <Search className={cn('h-4 w-4', searchLoading && 'animate-pulse')} />
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                找到 {searchResults.length} 条结果
              </p>
              {searchResults.map((result, idx) => (
                <Card key={idx} className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {result.type.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        分数：{result.score.toFixed(2)}
                      </span>
                    </div>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-40 overflow-auto">
                      {result.content}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Memories */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            最近记忆
          </h3>

          {memoriesLoading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!memoriesLoading && recentMemories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Brain className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                暂无记忆记录。记忆会在 AI 代理会话中生成。
              </p>
            </div>
          )}

          {recentMemories.length > 0 && (
            <div className="space-y-3">
              {recentMemories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
