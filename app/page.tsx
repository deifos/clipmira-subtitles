"use client";

import { useRef, useState } from "react";
import { VideoUpload } from "@/components/ui/video-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Download } from "lucide-react";
import { TranscriptSidebar } from "@/components/ui/transcript-sidebar";
import {
  SubtitleStyling,
  SubtitleStyle,
} from "@/components/ui/subtitle-styling";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import { useTranscription, STATUS_MESSAGES } from "@/hooks/useTranscription";
import { useVideoDownload } from "@/hooks/useVideoDownload";

// Default subtitle style
const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: "Arial, sans-serif",
  fontSize: 20,
  fontWeight: "normal",
  color: "#ffffff",
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  borderWidth: 0,
  borderColor: "#ffffff",
};

export default function Home() {
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
    DEFAULT_SUBTITLE_STYLE
  );
  const [uploadKey, setUploadKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    status,
    error,
    result,
    progress,
    setResult,
    setStatus,
    setProgress,
    handleVideoSelect,
    resetTranscription,
  } = useTranscription();

  const { handleDownloadVideo } = useVideoDownload({
    videoRef,
    result,
    subtitleStyle,
    setStatus,
    setProgress,
  });

  // Function to handle video reset and upload another
  const handleResetVideo = () => {
    // Reset transcription state
    resetTranscription();

    // Reset current time
    setCurrentTime(0);

    // Increment key to force VideoUpload component to remount
    setUploadKey((prev) => prev + 1);

    // Reset video element
    if (videoRef.current) {
      // First pause the video to prevent any issues
      videoRef.current.pause();
      // Clear the source
      videoRef.current.removeAttribute("src");
      // Force the browser to release any object URLs
      videoRef.current.load();
    }
  };

  // Determine if we should show the loading overlay
  const isProcessing = status !== "idle" && status !== "ready";

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 relative">
      <div className="w-full max-w-7xl space-y-6">
        <div className="flex justify-between items-center">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">
              Video Subtitle Generator
            </h1>
            <p className="text-gray-500">
              Upload a video (MP4 or WebM) to generate subtitles using AI
            </p>
          </div>

          {result && (
            <Button
              onClick={handleResetVideo}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Upload className="w-4 h-4" />
              Upload Another Video
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Subtitle Styling Column - Only show when we have a result */}
          {result && (
            <div className="w-full lg:w-72 h-[500px]">
              <ScrollArea className="rounded-base h-[500px] w-full text-mtext border-2 border-border bg-main p-4 shadow-shadow">
                <div className="p-4">
                  <SubtitleStyling
                    style={subtitleStyle}
                    onChange={setSubtitleStyle}
                  />
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Video Column */}
          <div className="flex-1 flex flex-col">
            <VideoUpload
              key={uploadKey}
              className="w-full"
              onVideoSelect={handleVideoSelect}
              ref={videoRef}
              onTimeUpdate={(time) => setCurrentTime(time)}
              transcript={result}
              currentTime={currentTime}
              subtitleStyle={subtitleStyle}
            />

            {result && (
              <div className="mt-4 flex justify-center">
                <Button
                  onClick={handleDownloadVideo}
                  className="flex items-center gap-2"
                  disabled={isProcessing}
                >
                  <Download className="w-4 h-4" />
                  Download Video with Subtitles
                </Button>
              </div>
            )}
          </div>

          {/* Transcript Column */}
          {result && (
            <div className="w-full lg:w-96 h-[500px]">
              <ScrollArea className="rounded-base h-[500px] w-full text-mtext border-2 border-border bg-main p-4 shadow-shadow">
                <TranscriptSidebar
                  transcript={result}
                  currentTime={currentTime}
                  setCurrentTime={(time) => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = time;
                      setCurrentTime(time);
                    }
                  }}
                  onTranscriptUpdate={(updatedTranscript) => {
                    setResult(updatedTranscript);
                  }}
                />
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Processing Overlay */}
      <ProcessingOverlay
        isVisible={isProcessing}
        statusMessage={STATUS_MESSAGES[status]}
        progress={progress}
      />
    </main>
  );
}
