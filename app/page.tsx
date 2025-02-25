"use client";

import { useState, useRef, useEffect } from "react";
import { VideoUpload } from "@/components/ui/video-upload";
import { extractAudioFromVideo } from "@/lib/audio-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, Download } from "lucide-react";
import { TranscriptSidebar } from "@/components/ui/transcript-sidebar";
import {
  SubtitleStyling,
  SubtitleStyle,
} from "@/components/ui/subtitle-styling";
import { Progress } from "@/components/ui/progress";

type TranscriptionStatus =
  | "idle"
  | "loading"
  | "extracting"
  | "transcribing"
  | "ready";

interface TranscriptionResult {
  text: string;
  chunks: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}

const STATUS_MESSAGES = {
  idle: "",
  loading: "Loading Whisper model...",
  extracting: "Extracting audio from video...",
  transcribing: "Transcribing audio...",
  ready: "Done!",
};

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
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
    DEFAULT_SUBTITLE_STYLE
  );
  const [progress, setProgress] = useState(0);
  const worker = useRef<Worker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [uploadKey, setUploadKey] = useState(0);

  // Initialize worker
  useEffect(() => {
    // Create the worker only once
    if (!worker.current) {
      console.log("Creating new worker instance");
      worker.current = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });

      // Create a callback function for messages from the worker thread
      const onMessageReceived = (e: MessageEvent) => {
        console.log("Worker message received:", e.data.status);
        switch (e.data.status) {
          case "loading":
            setStatus("loading");
            setProgress(10);
            break;

          case "ready":
            console.log("Model is ready");
            setStatus("ready");
            setProgress(30);
            break;

          case "progress":
            if (e.data.data && typeof e.data.data.progress === "number") {
              // Scale progress from 0-1 to 30-90 (leaving room for loading and completion)
              const scaledProgress = 30 + e.data.data.progress * 60;
              setProgress(Math.min(90, scaledProgress));
            }
            break;

          case "complete":
            console.log("Transcription complete");
            setResult(e.data.result);
            setStatus("ready");
            setProgress(100);
            break;

          case "error":
            console.error("Worker error:", e.data.data);
            setError(e.data.data);
            setStatus("idle");
            setProgress(0);
            break;
        }
      };

      // Attach the callback function as an event listener
      worker.current.addEventListener("message", onMessageReceived);
    }

    // Define a cleanup function for when the component is unmounted
    return () => {
      if (worker.current) {
        console.log("Cleaning up worker");
        worker.current.terminate();
        worker.current = null;
      }
    };
  }, []);

  const handleVideoSelect = async (file: File) => {
    try {
      // Reset states
      setError(null);
      setResult(null);
      setProgress(0);

      console.log(
        "Processing video:",
        file.name,
        "Size:",
        file.size,
        "Type:",
        file.type
      );

      // Ensure worker exists
      if (!worker.current) {
        throw new Error("Worker not initialized properly");
      }

      // First load the model and wait for it to be ready
      setStatus("loading");
      setProgress(5);
      console.log("Sending load message to worker");

      // Create a promise that resolves when the model is ready
      const modelReadyPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Model loading timed out"));
        }, 60000);

        const readyHandler = (e: MessageEvent) => {
          if (e.data.status === "ready") {
            console.log("Model ready signal received");
            clearTimeout(timeout);
            worker.current?.removeEventListener("message", readyHandler);
            resolve();
          } else if (e.data.status === "error") {
            clearTimeout(timeout);
            worker.current?.removeEventListener("message", readyHandler);
            reject(new Error(e.data.data));
          }
        };

        worker.current?.addEventListener("message", readyHandler);
      });

      // Send load message to worker
      worker.current.postMessage({
        type: "load",
        data: { device: "wasm" }, // Using wasm instead of webgpu for better compatibility
      });

      // Wait for model to be ready
      await modelReadyPromise;
      console.log("Model is ready, proceeding with audio extraction");

      // Extract audio from video
      setStatus("extracting");
      setProgress(40);
      console.log("Starting audio extraction...");
      const audioData = await extractAudioFromVideo(file);
      console.log("Audio extraction complete. Length:", audioData.length);
      setProgress(50);

      // Start transcription
      setStatus("transcribing");
      console.log("Starting transcription...");
      worker.current.postMessage({
        type: "run",
        data: {
          audio: audioData,
          language: "en",
        },
      });
    } catch (err) {
      console.error("Error in handleVideoSelect:", err);
      if (err instanceof Error) {
        console.error("Error stack:", err.stack);
      }
      setError(err instanceof Error ? err.message : String(err));
      setStatus("idle");
      setProgress(0);

      // Reset worker on error
      if (worker.current) {
        worker.current.terminate();
        worker.current = null;
      }
    }
  };

  // Function to handle video reset and upload another
  const handleResetVideo = () => {
    // Reset states
    setError(null);
    setResult(null);
    setStatus("idle");
    setCurrentTime(0);
    setProgress(0);

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

    // Recreate worker if needed
    if (!worker.current) {
      worker.current = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });

      worker.current.addEventListener("message", (e) => {
        console.log("Worker message received:", e.data.status);
        switch (e.data.status) {
          case "loading":
            setStatus("loading");
            setProgress(10);
            break;
          case "ready":
            console.log("Model is ready");
            setStatus("ready");
            setProgress(30);
            break;
          case "progress":
            if (e.data.data && typeof e.data.data.progress === "number") {
              const scaledProgress = 30 + e.data.data.progress * 60;
              setProgress(Math.min(90, scaledProgress));
            }
            break;
          case "complete":
            console.log("Transcription complete");
            setResult(e.data.result);
            setStatus("ready");
            setProgress(100);
            break;
          case "error":
            console.error("Worker error:", e.data.data);
            setError(e.data.data);
            setStatus("idle");
            setProgress(0);
            break;
        }
      });
    }
  };

  // Function to download the video with subtitles
  const handleDownloadVideo = () => {
    if (!videoRef.current || !videoRef.current.src) {
      console.error("No video source available");
      return;
    }

    // Create a temporary anchor element
    const a = document.createElement("a");
    a.href = videoRef.current.src;
    a.download = "video_with_subtitles.mp4"; // Default name, browser will handle actual format
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
            <button
              onClick={handleResetVideo}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Upload className="w-4 h-4" />
              Upload Another Video
            </button>
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
              <SubtitleStyling
                style={subtitleStyle}
                onChange={setSubtitleStyle}
              />
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
                <button
                  onClick={handleDownloadVideo}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
                >
                  <Download className="w-4 h-4" />
                  Download Video
                </button>
              </div>
            )}
          </div>

          {/* Transcript Column */}
          {result && (
            <div className="w-full lg:w-96 h-[500px] border rounded-lg overflow-hidden">
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
            </div>
          )}
        </div>
      </div>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full space-y-4">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h3 className="text-xl font-medium">{STATUS_MESSAGES[status]}</h3>
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
      )}
    </main>
  );
}
