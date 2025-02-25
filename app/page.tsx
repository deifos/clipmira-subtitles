"use client";

import { useState, useRef, useEffect } from "react";
import { VideoUpload } from "@/components/ui/video-upload";
import { extractAudioFromVideo } from "@/lib/audio-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { TranscriptSidebar } from "@/components/ui/transcript-sidebar";

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

export default function Home() {
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const worker = useRef<Worker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
            break;

          case "ready":
            console.log("Model is ready");
            setStatus("ready");
            break;

          case "complete":
            console.log("Transcription complete");
            setResult(e.data.result);
            setStatus("ready");
            break;

          case "error":
            console.error("Worker error:", e.data.data);
            setError(e.data.data);
            setStatus("idle");
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
      console.log("Starting audio extraction...");
      const audioData = await extractAudioFromVideo(file);
      console.log("Audio extraction complete. Length:", audioData.length);

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

      // Reset worker on error
      if (worker.current) {
        worker.current.terminate();
        worker.current = null;
      }
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-7xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">
            Video Subtitle Generator
          </h1>
          <p className="text-gray-500">
            Upload a video (MP4 or WebM) to generate subtitles using AI
          </p>
        </div>

        {status !== "idle" && (
          <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
            {status !== "ready" && <Loader2 className="h-4 w-4 animate-spin" />}
            <p>{STATUS_MESSAGES[status]}</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <VideoUpload
              className="w-full"
              onVideoSelect={handleVideoSelect}
              ref={videoRef}
              onTimeUpdate={(time) => setCurrentTime(time)}
              transcript={result}
              currentTime={currentTime}
            />
          </div>

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
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
