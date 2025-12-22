import { Database, Globe } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { InfrastructureStatus } from './InfrastructureStatus';
import { PasswordInput } from './PasswordInput';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import type { ProjectEnvConfig, ProjectSettings, InfrastructureStatus as InfrastructureStatusType } from '../../../shared/types';

interface MemoryBackendSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  envConfig: ProjectEnvConfig;
  settings: ProjectSettings;
  onUpdateConfig: (updates: Partial<ProjectEnvConfig>) => void;
  onUpdateSettings: (updates: Partial<ProjectSettings>) => void;
  infrastructureStatus: InfrastructureStatusType | null;
  isCheckingInfrastructure: boolean;
  isStartingFalkorDB: boolean;
  isOpeningDocker: boolean;
  onStartFalkorDB: () => void;
  onOpenDockerDesktop: () => void;
  onDownloadDocker: () => void;
}

export function MemoryBackendSection({
  isExpanded,
  onToggle,
  envConfig,
  settings,
  onUpdateConfig,
  onUpdateSettings,
  infrastructureStatus,
  isCheckingInfrastructure,
  isStartingFalkorDB,
  isOpeningDocker,
  onStartFalkorDB,
  onOpenDockerDesktop,
  onDownloadDocker,
}: MemoryBackendSectionProps) {
  const badge = (
    <span className={`px-2 py-0.5 text-xs rounded-full ${
      envConfig.graphitiEnabled
        ? 'bg-success/10 text-success'
        : 'bg-muted text-muted-foreground'
    }`}>
      {envConfig.graphitiEnabled ? 'Graphiti' : '基于文件'}
    </span>
  );

  return (
    <CollapsibleSection
      title="记忆后端"
      icon={<Database className="h-4 w-4" />}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={badge}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">使用 Graphiti（推荐）</Label>
          <p className="text-xs text-muted-foreground">
            使用 FalkorDB 图数据库实现跨会话持久记忆
          </p>
        </div>
        <Switch
          checked={envConfig.graphitiEnabled}
          onCheckedChange={(checked) => {
            onUpdateConfig({ graphitiEnabled: checked });
            // Also update project settings to match
            onUpdateSettings({ memoryBackend: checked ? 'graphiti' : 'file' });
          }}
        />
      </div>

      {!envConfig.graphitiEnabled && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            使用基于文件的记忆。会话洞察会存储在本地 JSON 文件中。
            启用 Graphiti 以获得带语义搜索的跨会话持久记忆。
          </p>
        </div>
      )}

      {envConfig.graphitiEnabled && (
        <>
          {/* Infrastructure Status - Dynamic Docker/FalkorDB check */}
          <InfrastructureStatus
            infrastructureStatus={infrastructureStatus}
            isCheckingInfrastructure={isCheckingInfrastructure}
            isStartingFalkorDB={isStartingFalkorDB}
            isOpeningDocker={isOpeningDocker}
            onStartFalkorDB={onStartFalkorDB}
            onOpenDockerDesktop={onOpenDockerDesktop}
            onDownloadDocker={onDownloadDocker}
          />

          {/* Graphiti MCP Server Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-normal text-foreground">启用智能体记忆访问</Label>
              <p className="text-xs text-muted-foreground">
                允许智能体通过 MCP 搜索并写入知识图谱
              </p>
            </div>
            <Switch
              checked={settings.graphitiMcpEnabled}
              onCheckedChange={(checked) =>
                onUpdateSettings({ graphitiMcpEnabled: checked })
              }
            />
          </div>

          {settings.graphitiMcpEnabled && (
            <div className="space-y-2 ml-6">
              <Label className="text-sm font-medium text-foreground">Graphiti MCP 服务器 URL</Label>
              <p className="text-xs text-muted-foreground">
                Graphiti MCP 服务器的 URL（需要 Docker 容器）
              </p>
              <Input
                placeholder="http://localhost:8000/mcp/"
                value={settings.graphitiMcpUrl || ''}
                onChange={(e) => onUpdateSettings({ graphitiMcpUrl: e.target.value || undefined })}
              />
              <div className="rounded-lg border border-info/30 bg-info/5 p-3">
                <p className="text-xs text-info">
                  启动 MCP 服务器：{' '}
                  <code className="px-1 bg-info/10 rounded">docker run -d -p 8000:8000 falkordb/graphiti-knowledge-graph-mcp</code>
                </p>
              </div>
            </div>
          )}

          <Separator />

          {/* LLM Provider Selection - V2 Multi-provider support */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">LLM 提供商</Label>
            <p className="text-xs text-muted-foreground">
              用于图操作（抽取、搜索、推理）的提供商
            </p>
            <Select
              value={envConfig.graphitiProviderConfig?.llmProvider || 'openai'}
              onValueChange={(value) => onUpdateConfig({
                graphitiProviderConfig: {
                  ...envConfig.graphitiProviderConfig,
                  llmProvider: value as 'openai' | 'anthropic' | 'azure_openai' | 'ollama' | 'google' | 'groq',
                  embeddingProvider: envConfig.graphitiProviderConfig?.embeddingProvider || 'openai',
                }
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择 LLM 提供商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI (GPT-4o-mini)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="google">Google AI (Gemini)</SelectItem>
                <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                <SelectItem value="ollama">Ollama（本地）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Embedding Provider Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">嵌入提供商</Label>
            <p className="text-xs text-muted-foreground">
              用于语义搜索向量嵌入的提供商
            </p>
            <Select
              value={envConfig.graphitiProviderConfig?.embeddingProvider || 'openai'}
              onValueChange={(value) => onUpdateConfig({
                graphitiProviderConfig: {
                  ...envConfig.graphitiProviderConfig,
                  llmProvider: envConfig.graphitiProviderConfig?.llmProvider || 'openai',
                  embeddingProvider: value as 'openai' | 'voyage' | 'azure_openai' | 'ollama' | 'google' | 'huggingface',
                }
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择嵌入提供商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="voyage">Voyage AI</SelectItem>
                <SelectItem value="google">Google AI</SelectItem>
                <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                <SelectItem value="ollama">Ollama（本地）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">
                OpenAI API 密钥 {envConfig.openaiKeyIsGlobal ? '（覆盖）' : ''}
              </Label>
              {envConfig.openaiKeyIsGlobal && (
                <span className="flex items-center gap-1 text-xs text-info">
                  <Globe className="h-3 w-3" />
                  使用全局密钥
                </span>
              )}
            </div>
            {envConfig.openaiKeyIsGlobal ? (
              <p className="text-xs text-muted-foreground">
                使用应用设置中的密钥。输入项目专用密钥可覆盖。
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                使用 OpenAI 作为 LLM 或嵌入提供商时需要
              </p>
            )}
            <PasswordInput
              value={envConfig.openaiKeyIsGlobal ? '' : (envConfig.openaiApiKey || '')}
              onChange={(value) => onUpdateConfig({ openaiApiKey: value || undefined })}
              placeholder={envConfig.openaiKeyIsGlobal ? '输入以覆盖全局密钥...' : 'sk-xxxxxxxx'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">FalkorDB 主机</Label>
              <Input
                placeholder="localhost"
                value={envConfig.graphitiFalkorDbHost || ''}
                onChange={(e) => onUpdateConfig({ graphitiFalkorDbHost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">FalkorDB 端口</Label>
              <Input
                type="number"
                placeholder="6380"
                value={envConfig.graphitiFalkorDbPort || ''}
                onChange={(e) => onUpdateConfig({ graphitiFalkorDbPort: parseInt(e.target.value) || undefined })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">FalkorDB 密码（可选）</Label>
            <PasswordInput
              value={envConfig.graphitiFalkorDbPassword || ''}
              onChange={(value) => onUpdateConfig({ graphitiFalkorDbPassword: value })}
              placeholder="没有可留空"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">数据库名称</Label>
            <Input
              placeholder="auto_claude_memory"
              value={envConfig.graphitiDatabase || ''}
              onChange={(e) => onUpdateConfig({ graphitiDatabase: e.target.value })}
            />
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
