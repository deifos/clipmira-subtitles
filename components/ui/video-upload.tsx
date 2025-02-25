"use client";

import { useCallback, useState, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { VideoCaption } from "./video-caption";

interface VideoUploadProps {
  onVideoSelect: (file: File) => void;
  onTimeUpdate?: (time: number) => void;
  className?: string;
  transcript?: {
    text: string;
    chunks: Array<{
      text: string;
      timestamp: [number, number];
    }>;
  } | null;
  currentTime?: number;
}

export const VideoUpload = forwardRef<HTMLVideoElement, VideoUploadProps>(
  (
    { onVideoSelect, onTimeUpdate, className, transcript, currentTime = 0 },
    ref
  ) => {
    const [isDragging, setIsDragging] = useState(false);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFile = useCallback(
      async (file: File) => {
        try {
          if (!file.type.startsWith("video/")) {
            throw new Error("Please select a video file");
          }

          // Create video element to check duration
          const video = document.createElement("video");
          video.preload = "metadata";

          await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
            video.src = URL.createObjectURL(file);
          });

          if (video.duration > 300) {
            URL.revokeObjectURL(video.src);
            throw new Error("Video must be less than 5 minutes");
          }

          setVideoSrc(video.src);
          setError(null);
          onVideoSelect(file);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error loading video");
          setVideoSrc(null);
        }
      },
      [onVideoSelect]
    );

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      },
      [handleFile]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
      },
      [handleFile]
    );

    return (
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-colors min-h-[100px] max-h-[500px] overflow-hidden",
          isDragging ? "border-primary" : "border-muted-foreground/25",
          className
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {videoSrc ? (
          <div className="relative flex items-center justify-center w-full h-full">
            <video
              ref={ref}
              src={videoSrc}
              controls
              className="w-full max-h-[500px] object-contain"
              onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
            />
            {transcript && (
              <VideoCaption transcript={transcript} currentTime={currentTime} />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <input
              type="file"
              accept="video/*"
              onChange={handleChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop a video file here, or click to select
            </p>
            <p className="text-xs text-muted-foreground">
              Supports MP4 and WebM formats, max 5 minutes
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center mt-2">{error}</p>
        )}
      </div>
    );
  }
);

VideoUpload.displayName = "VideoUpload";
