import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';

interface InitializationGuardProps {
  initialized: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onInitialize?: () => void | Promise<void>;
  isInitializing?: boolean;
  initializeLabel?: string;
}

/**
 * Guard component that shows a message when Auto-Build is not initialized.
 * Used to prevent configuration of features that require Auto-Build setup.
 */
export function InitializationGuard({
  initialized,
  title,
  description,
  children,
  onInitialize,
  isInitializing = false,
  initializeLabel = '初始化 Auto-Build'
}: InitializationGuardProps) {
  if (!initialized) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">需要初始化 Auto-Build</p>
          <p className="text-xs text-muted-foreground">
            初始化后才能配置「{title}」。{description}
          </p>
        </div>

        {onInitialize && (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isInitializing}
              onClick={() => void onInitialize()}
            >
              {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initializeLabel}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
