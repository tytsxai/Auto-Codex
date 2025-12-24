import { useState } from 'react';
import {
  Play,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileCode,
  AlertTriangle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Lightbulb
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from './ui/collapsible';
import type { ReviewReport, ReviewIssue, TestResults } from '../../shared/types';

interface AIReviewPanelProps {
  onReviewComplete?: (report: ReviewReport) => void;
}

export function AIReviewPanel({ onReviewComplete }: AIReviewPanelProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['issues', 'tests', 'suggestions'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleReview = async () => {
    setIsReviewing(true);
    setError(null);
    setReport(null);

    try {
      const result = await window.electronAPI.aiReview();
      if (result.success && result.data) {
        setReport(result.data);
        onReviewComplete?.(result.data);
      } else {
        setError(result.error || 'AI 审查失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 审查失败');
    } finally {
      setIsReviewing(false);
    }
  };

  const getIssueIcon = (type: ReviewIssue['type']) => {
    switch (type) {
      case 'conflict':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'syntax_error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'test_failure':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'import_error':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'type_mismatch':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getIssueLabel = (type: ReviewIssue['type']) => {
    switch (type) {
      case 'conflict':
        return '冲突';
      case 'syntax_error':
        return '语法错误';
      case 'test_failure':
        return '测试失败';
      case 'import_error':
        return '导入错误';
      case 'type_mismatch':
        return '类型不匹配';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with review button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">AI 代码审查</h3>
          <p className="text-sm text-muted-foreground">
            分析暂存更改，检测冲突和问题
          </p>
        </div>
        <Button onClick={handleReview} disabled={isReviewing}>
          {isReviewing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              审查中...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              开始审查
            </>
          )}
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-destructive">审查失败</p>
              <p className="text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Review Report */}
      {report && (
        <div className="space-y-4">
          {/* Summary */}
          <Card
            className={
              report.success
                ? 'border-success/50 bg-success/5'
                : 'border-warning/50 bg-warning/5'
            }
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                {report.success ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-warning" />
                )}
                <CardTitle className="text-base">
                  {report.success ? '审查通过' : '发现问题'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">{report.summary}</p>
            </CardContent>
          </Card>

          {/* Issues */}
          {report.issues.length > 0 && (
            <Collapsible
              open={expandedSections.has('issues')}
              onOpenChange={() => toggleSection('issues')}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedSections.has('issues') ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <AlertCircle className="h-4 w-4 text-warning" />
                        <CardTitle className="text-base">问题</CardTitle>
                        <Badge variant="outline" className="text-warning border-warning/50">
                          {report.issues.length}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <ScrollArea className="max-h-64">
                      <div className="space-y-3">
                        {report.issues.map((issue, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-border bg-muted/30 p-3"
                          >
                            <div className="flex items-start gap-2">
                              {getIssueIcon(issue.type)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs">
                                    {getIssueLabel(issue.type)}
                                  </Badge>
                                  {issue.file && (
                                    <span className="font-mono text-xs text-muted-foreground truncate">
                                      {issue.file}
                                      {issue.line && `:${issue.line}`}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-foreground mt-1">{issue.message}</p>
                                {issue.suggestion && (
                                  <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                                    <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
                                    {issue.suggestion}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Test Results */}
          {report.testResults && (
            <Collapsible
              open={expandedSections.has('tests')}
              onOpenChange={() => toggleSection('tests')}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedSections.has('tests') ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <FileCode className="h-4 w-4 text-info" />
                        <CardTitle className="text-base">测试结果</CardTitle>
                        {report.testResults.success ? (
                          <Badge variant="outline" className="text-success border-success/50">
                            通过
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive/50">
                            失败
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <TestResultsDisplay results={report.testResults} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Suggestions */}
          {report.suggestions.length > 0 && (
            <Collapsible
              open={expandedSections.has('suggestions')}
              onOpenChange={() => toggleSection('suggestions')}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedSections.has('suggestions') ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Lightbulb className="h-4 w-4 text-info" />
                        <CardTitle className="text-base">建议</CardTitle>
                        <Badge variant="outline">{report.suggestions.length}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <ul className="space-y-2">
                      {report.suggestions.map((suggestion, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <span className="text-info">•</span>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>
      )}

      {/* Empty state */}
      {!report && !isReviewing && !error && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <div className="rounded-full bg-muted p-3 w-fit mx-auto mb-3">
            <Play className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            点击"开始审查"分析暂存的更改
          </p>
        </div>
      )}
    </div>
  );
}

function TestResultsDisplay({ results }: { results: TestResults }) {
  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-success font-medium">{results.passed}</span>
          <span className="text-muted-foreground">通过</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="h-4 w-4 text-destructive" />
          <span className="text-destructive font-medium">{results.failed}</span>
          <span className="text-muted-foreground">失败</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{results.skipped}</span>
          <span className="text-muted-foreground">跳过</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {results.durationSeconds.toFixed(2)}s
          </span>
        </div>
      </div>

      {/* Errors */}
      {results.errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-destructive">错误：</p>
          {results.errors.map((err, i) => (
            <div
              key={i}
              className="rounded bg-destructive/10 border border-destructive/30 p-2 text-xs font-mono text-destructive"
            >
              {err}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
