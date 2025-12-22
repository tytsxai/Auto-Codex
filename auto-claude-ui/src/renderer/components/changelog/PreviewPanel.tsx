import { useState } from 'react';
import { FileText, Copy, Save, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PreviewPanelProps {
  generatedChangelog: string;
  saveSuccess: boolean;
  copySuccess: boolean;
  canSave: boolean;
  isDragOver: boolean;
  imageError: string | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSave: () => void;
  onCopy: () => void;
  onChangelogEdit: (content: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function PreviewPanel({
  generatedChangelog,
  saveSuccess,
  copySuccess,
  canSave,
  isDragOver,
  imageError,
  textareaRef,
  onSave,
  onCopy,
  onChangelogEdit,
  onPaste,
  onDragOver,
  onDragLeave,
  onDrop
}: PreviewPanelProps) {
  const [viewMode, setViewMode] = useState<'markdown' | 'preview'>('markdown');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Preview Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <h2 className="font-medium">预览</h2>
          <div className="flex items-center gap-1 rounded-md border border-border p-1">
            <Button
              variant={viewMode === 'markdown' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('markdown')}
              className="h-7 px-3 text-xs"
            >
              Markdown
            </Button>
            <Button
              variant={viewMode === 'preview' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('preview')}
              className="h-7 px-3 text-xs"
            >
              预览
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onCopy}
                disabled={!canSave}
              >
                {copySuccess ? (
                  <CheckCircle className="mr-2 h-4 w-4 text-success" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copySuccess ? '已复制！' : '复制'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>复制到剪贴板</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={onSave}
                disabled={!canSave}
              >
                {saveSuccess ? (
                  <CheckCircle className="mr-2 h-4 w-4" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saveSuccess ? '已保存！' : '保存到 CHANGELOG.md'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              添加到项目根目录的 CHANGELOG.md 顶部
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Preview Content */}
      <div
        className={`flex-1 overflow-hidden p-6 ${isDragOver ? 'bg-muted/50' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {generatedChangelog ? (
          <>
            {isDragOver && (
              <div className="mb-4 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 p-4 text-center">
                <ImageIcon className="mx-auto h-8 w-8 text-primary/50" />
                <p className="mt-2 text-sm text-primary/70">将图片拖放到此处以添加到变更日志</p>
              </div>
            )}
            {imageError && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {imageError}
              </div>
            )}
            {viewMode === 'markdown' ? (
              <div className="flex h-full flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>将图片粘贴到描述中以保存到变更日志</span>
                </div>
                <Textarea
                  ref={textareaRef}
                  className="flex-1 w-full resize-none font-mono text-sm"
                  value={generatedChangelog}
                  onChange={(e) => onChangelogEdit(e.target.value)}
                  onPaste={onPaste}
                  placeholder="生成的变更日志将显示在这里..."
                />
              </div>
            ) : (
              <div className="h-full overflow-auto">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {generatedChangelog}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm text-muted-foreground">
                点击“生成变更日志”创建发布说明。
              </p>
              <p className="mt-2 text-xs text-muted-foreground flex items-center justify-center gap-2">
                <ImageIcon className="h-3.5 w-3.5" />
                <span>将图片粘贴到描述中以保存到变更日志</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
