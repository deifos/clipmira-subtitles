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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full space-y-4">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <h3 className="text-xl font-medium">{statusMessage}</h3>
          <div className="w-full space-y-2">
            <Progress value={progress} className="w-full h-2" />
            <p className="text-sm text-muted-foreground text-center">
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
