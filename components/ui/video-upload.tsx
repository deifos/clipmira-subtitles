"use client";

import { useCallback, useState, forwardRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { VideoCaption } from "./video-caption";
import { SubtitleStyle } from "./subtitle-styling";
import { UploadIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VideoUploadProps {
  onVideoSelect: (file: File) => void;
  onTimeUpdate?: (time: number) => void;
  className?: string;
  transcript?: {
    text: string;
    chunks: Array<{
      text: string;
      timestamp: [number, number];
      disabled?: boolean;
    }>;
  } | null;
  currentTime?: number;
  subtitleStyle: SubtitleStyle;
  mode: "word" | "phrase";
  onModeChange: (mode: "word" | "phrase") => void;
  ratio: "16:9" | "9:16";
  onRatioChange: (ratio: "16:9" | "9:16") => void;
}

export const VideoUpload = forwardRef<HTMLVideoElement, VideoUploadProps>(
  (
    {
      onVideoSelect,
      onTimeUpdate,
      className,
      transcript,
      currentTime = 0,
      subtitleStyle,
      mode,
      onModeChange,
      ratio,
      onRatioChange,
    },
    ref
  ) => {
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSkipping, setIsSkipping] = useState(false);

    // Reset video source when ref.current.src is empty
    useEffect(() => {
      if (ref && typeof ref !== "function" && ref.current) {
        // Check if the video element has no source
        if (!ref.current.src || ref.current.src === window.location.href) {
          setVideoSrc(null);
        }
      }
    }, [ref]);

    // Reset state when component is mounted
    useEffect(() => {
      setVideoSrc(null);
      setError(null);
    }, []);

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

        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      },
      [handleFile]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);

        // Reset the input value to allow selecting the same file again
        e.target.value = "";
      },
      [handleFile]
    );

    // Function to get disabled time ranges
    const getDisabledRanges = useCallback(() => {
      if (!transcript) return [];
      
      const disabledRanges: Array<[number, number]> = [];
      
      transcript.chunks.forEach(chunk => {
        if (chunk.disabled) {
          disabledRanges.push(chunk.timestamp);
        }
      });
      
      // Sort ranges by start time and merge overlapping ranges
      disabledRanges.sort((a, b) => a[0] - b[0]);
      const mergedRanges: Array<[number, number]> = [];
      
      for (const range of disabledRanges) {
        if (mergedRanges.length === 0 || mergedRanges[mergedRanges.length - 1][1] < range[0]) {
          mergedRanges.push(range);
        } else {
          // Merge overlapping ranges
          mergedRanges[mergedRanges.length - 1][1] = Math.max(
            mergedRanges[mergedRanges.length - 1][1],
            range[1]
          );
        }
      }
      
      return mergedRanges;
    }, [transcript]);

    // Function to handle time updates and skip disabled segments
    const handleTimeUpdate = useCallback(
      (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget;
        const currentTime = video.currentTime;
        
        // Call the original onTimeUpdate
        onTimeUpdate?.(currentTime);
        
        // Skip disabled segments
        if (!isSkipping && transcript) {
          const disabledRanges = getDisabledRanges();
          
          for (const [start, end] of disabledRanges) {
            // If current time is within a disabled range, skip to the end
            if (currentTime >= start && currentTime < end) {
              setIsSkipping(true);
              video.currentTime = end + 0.1; // Add small buffer to avoid edge cases
              
              // Reset skipping flag after a short delay
              setTimeout(() => {
                setIsSkipping(false);
              }, 100);
              break;
            }
          }
        }
      },
      [onTimeUpdate, transcript, isSkipping, getDisabledRanges]
    );

    return (
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-colors min-h-[300px] overflow-hidden",
          className
        )}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={handleDrop}
      >
        {videoSrc ? (
          <div className="relative flex flex-col items-center justify-center w-full h-full">
            {transcript && (
              <>
                <div className="flex flex-col gap-2 mb-4">
                  <Tabs
                    defaultValue={mode}
                    onValueChange={(v) => onModeChange(v as "word" | "phrase")}
                  >
                    <TabsList className="grid w-[400px] grid-cols-2">
                      <TabsTrigger value="word">Word by Word</TabsTrigger>
                      <TabsTrigger value="phrase">Phrases</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Tabs
                    defaultValue={ratio}
                    onValueChange={(v) => onRatioChange(v as "16:9" | "9:16")}
                  >
                    <TabsList className="grid w-[400px] grid-cols-2">
                      <TabsTrigger value="16:9">Landscape (16:9)</TabsTrigger>
                      <TabsTrigger value="9:16">Portrait (9:16)</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </>
            )}
            <div className="relative">
              <video
                ref={ref}
                src={videoSrc}
                controls
                className={cn(
                  "max-h-[500px] object-contain",
                  ratio === "16:9" ? "w-full" : "w-auto h-full"
                )}
                onTimeUpdate={handleTimeUpdate}
              />
              {isSkipping && (
                <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded-md text-sm font-medium">
                  ⏭️ Skipping disabled segment
                </div>
              )}
            </div>
            {transcript && (
              <VideoCaption
                transcript={transcript}
                currentTime={currentTime}
                style={subtitleStyle}
                mode={mode}
                ratio={ratio}
              />
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
            <p className="mb-2">
              Drag and drop a video file here, or click to select{" "}
              <UploadIcon className="mx-auto mt-8" />
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
