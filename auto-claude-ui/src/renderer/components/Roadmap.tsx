import { useState } from 'react';
import { RoadmapGenerationProgress } from './RoadmapGenerationProgress';
import { CompetitorAnalysisDialog } from './CompetitorAnalysisDialog';
import { ExistingCompetitorAnalysisDialog } from './ExistingCompetitorAnalysisDialog';
import { CompetitorAnalysisViewer } from './CompetitorAnalysisViewer';
import { AddFeatureDialog } from './AddFeatureDialog';
import { RoadmapHeader } from './roadmap/RoadmapHeader';
import { RoadmapEmptyState } from './roadmap/RoadmapEmptyState';
import { RoadmapTabs } from './roadmap/RoadmapTabs';
import { FeatureDetailPanel } from './roadmap/FeatureDetailPanel';
import { useRoadmapData, useFeatureActions, useRoadmapGeneration, useRoadmapSave, useFeatureDelete } from './roadmap/hooks';
import { getCompetitorInsightsForFeature } from './roadmap/utils';
import type { RoadmapFeature } from '../../shared/types';
import type { RoadmapProps } from './roadmap/types';

export function Roadmap({ projectId, onGoToTask }: RoadmapProps) {
  // 状态管理
  const [selectedFeature, setSelectedFeature] = useState<RoadmapFeature | null>(null);
  const [activeTab, setActiveTab] = useState('kanban');
  const [showAddFeatureDialog, setShowAddFeatureDialog] = useState(false);
  const [showCompetitorViewer, setShowCompetitorViewer] = useState(false);

  // 自定义 Hooks
  const { roadmap, competitorAnalysis, generationStatus } = useRoadmapData(projectId);
  const { convertFeatureToSpec } = useFeatureActions();
  const { saveRoadmap } = useRoadmapSave(projectId);
  const { deleteFeature } = useFeatureDelete(projectId);
  const {
    competitorAnalysisDate,
    // 针对已有分析的新对话框
    showExistingAnalysisDialog,
    setShowExistingAnalysisDialog,
    handleUseExistingAnalysis,
    handleRunNewAnalysis,
    handleSkipAnalysis,
    // 无已有分析时的原始对话框
    showCompetitorDialog,
    setShowCompetitorDialog,
    handleGenerate,
    handleRefresh,
    handleCompetitorDialogAccept,
    handleCompetitorDialogDecline,
    handleStop,
  } = useRoadmapGeneration(projectId);

  // 事件处理
  const handleConvertToSpec = async (feature: RoadmapFeature) => {
    await convertFeatureToSpec(projectId, feature, selectedFeature, setSelectedFeature);
  };

  const handleGoToTask = (specId: string) => {
    if (onGoToTask) {
      onGoToTask(specId);
    }
  };

  // 显示生成进度
  if (generationStatus.phase !== 'idle' && generationStatus.phase !== 'complete') {
    return (
      <div className="flex h-full items-center justify-center">
        <RoadmapGenerationProgress
          generationStatus={generationStatus}
          className="w-full max-w-md"
          onStop={handleStop}
        />
      </div>
    );
  }

  // 显示空状态
  if (!roadmap) {
    return (
      <>
        <RoadmapEmptyState onGenerate={handleGenerate} />
        {/* 无已有竞品分析的项目对话框 */}
        <CompetitorAnalysisDialog
          open={showCompetitorDialog}
          onOpenChange={setShowCompetitorDialog}
          onAccept={handleCompetitorDialogAccept}
          onDecline={handleCompetitorDialogDecline}
        />
        {/* 有已有竞品分析的项目对话框 */}
        <ExistingCompetitorAnalysisDialog
          open={showExistingAnalysisDialog}
          onOpenChange={setShowExistingAnalysisDialog}
          onUseExisting={handleUseExistingAnalysis}
          onRunNew={handleRunNewAnalysis}
          onSkip={handleSkipAnalysis}
          analysisDate={competitorAnalysisDate}
        />
      </>
    );
  }

  // 主路线图视图
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 头部 */}
      <RoadmapHeader
        roadmap={roadmap}
        competitorAnalysis={competitorAnalysis}
        onAddFeature={() => setShowAddFeatureDialog(true)}
        onRefresh={handleRefresh}
        onViewCompetitorAnalysis={() => setShowCompetitorViewer(true)}
      />

      {/* 内容 */}
      <div className="flex-1 overflow-hidden">
        <RoadmapTabs
          roadmap={roadmap}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onFeatureSelect={setSelectedFeature}
          onConvertToSpec={handleConvertToSpec}
          onGoToTask={handleGoToTask}
          onSave={saveRoadmap}
        />
      </div>

      {/* 功能详情面板 */}
      {selectedFeature && (
        <FeatureDetailPanel
          feature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
          onConvertToSpec={handleConvertToSpec}
          onGoToTask={handleGoToTask}
          onDelete={deleteFeature}
          competitorInsights={getCompetitorInsightsForFeature(selectedFeature, competitorAnalysis)}
        />
      )}

      {/* 竞品分析权限对话框（无已有分析） */}
      <CompetitorAnalysisDialog
        open={showCompetitorDialog}
        onOpenChange={setShowCompetitorDialog}
        onAccept={handleCompetitorDialogAccept}
        onDecline={handleCompetitorDialogDecline}
      />

      {/* 竞品分析选项对话框（已有分析） */}
      <ExistingCompetitorAnalysisDialog
        open={showExistingAnalysisDialog}
        onOpenChange={setShowExistingAnalysisDialog}
        onUseExisting={handleUseExistingAnalysis}
        onRunNew={handleRunNewAnalysis}
        onSkip={handleSkipAnalysis}
        analysisDate={competitorAnalysisDate}
      />

      {/* 竞品分析查看器 */}
      <CompetitorAnalysisViewer
        analysis={competitorAnalysis}
        open={showCompetitorViewer}
        onOpenChange={setShowCompetitorViewer}
      />

      {/* 添加功能对话框 */}
      <AddFeatureDialog
        phases={roadmap.phases}
        open={showAddFeatureDialog}
        onOpenChange={setShowAddFeatureDialog}
      />
    </div>
  );
}
