import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ProcessingOverlayProps {
  isVisible: boolean;
  statusMessage: string;
  progress: number;
}

export function ProcessingOverlay({
  isVisible,
  statusMessage,
  progress,
}: ProcessingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-xl max-w-md w-full space-y-6 border border-border">
        <div className="flex flex-col items-center justify-center space-y-5">
          <Loader2 className="h-14 w-14 animate-spin text-primary" />
          <h3 className="text-2xl font-medium text-center">{statusMessage}</h3>
          <div className="w-full space-y-3">
            <Progress value={progress} className="w-full h-3" />
            <p className="text-sm text-muted-foreground text-center font-medium">
              {progress < 100
                ? `${Math.round(progress)}% complete`
                : "Processing complete"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
