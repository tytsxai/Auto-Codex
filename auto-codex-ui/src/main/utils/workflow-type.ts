import type { TaskCategory } from '../../shared/types';

export type WorkflowType = 'feature' | 'refactor' | 'investigation' | 'migration' | 'simple';

export function mapCategoryToWorkflowType(category?: TaskCategory | string | null): WorkflowType {
  switch (category) {
    case 'refactoring':
      return 'refactor';
    case 'documentation':
    case 'testing':
      return 'simple';
    case 'infrastructure':
      return 'migration';
    case 'bug_fix':
    case 'security':
    case 'performance':
    case 'ui_ux':
    case 'feature':
    default:
      return 'feature';
  }
}
