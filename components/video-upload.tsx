import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface VideoUploadProps {
  onVideoSelect: (file: File) => void;
}

export function VideoUpload({ onVideoSelect }: VideoUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateVideo = async (file: File): Promise<boolean> => {
    // Check file type
    const validTypes = ["video/mp4", "video/webm"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload an MP4 or WebM video file.");
      return false;
    }

    // Create video element to check duration
    const video = document.createElement("video");
    video.preload = "metadata";

    return new Promise<boolean>((resolve) => {
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > 300) {
          // 5 minutes = 300 seconds
          setError("Video must be less than 5 minutes long.");
          resolve(false);
        }
        resolve(true);
      };

      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    setError(null);

    if (file) {
      const isValid = await validateVideo(file);
      if (isValid) {
        onVideoSelect(file);
      }
    }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <Input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button onClick={handleButtonClick} className="w-full">
        Upload Video
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
