import { useState, useRef, useEffect } from "react";
import { extractAudioFromVideo } from "@/lib/audio-utils";

export type TranscriptionStatus =
  | "idle"
  | "loading"
  | "extracting"
  | "uploading"
  | "transcribing"
  | "processing"
  | "ready";

export interface TranscriptionResult {
  text: string;
  chunks: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}

export const STATUS_MESSAGES: Record<TranscriptionStatus, string> = {
  idle: "Ready to start",
  loading: "Loading model...",
  extracting: "Extracting audio...",
  uploading: "Uploading video...",
  transcribing: "Trying to understand your gibberish...",
  processing: "Processing video...",
  ready: "Ready",
};

export function useTranscription() {
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [progress, setProgress] = useState(0);
  const worker = useRef<Worker | null>(null);

  // Initialize worker
  useEffect(() => {
    // Create the worker only once
    if (!worker.current) {
      console.log("Creating new worker instance");
      worker.current = new Worker(
        new URL("../app/worker.ts", import.meta.url),
        {
          type: "module",
        }
      );

      // Simplified message handler like sample app
      const onMessageReceived = (e: MessageEvent) => {
        switch (e.data.status) {
          case "loading":
            setStatus("loading");
            break;

          case "ready":
            setStatus("ready");
            break;

          case "complete":
            setResult(e.data.result);
            setStatus("ready");
            setProgress(100);
            break;

          case "error":
            setError(e.data.data);
            setStatus("idle");
            setProgress(0);
            break;

          // Handle model loading progress directly
          case "progress":
          case "initiate":
          case "download":
          case "done":
            // Forward progress events for model loading
            if (e.data.progress !== undefined) {
              setProgress(Math.round(e.data.progress * 100));
            }
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

      // Check if model needs to be loaded
      if (status === null || status === "idle") {
        setStatus("loading");
        worker.current.postMessage({
          type: "load",
          data: { device: "wasm" }, // Using wasm for better compatibility
        });
        
        // Wait for model to be ready
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Model loading timed out"));
          }, 60000);

          const readyHandler = (e: MessageEvent) => {
            if (e.data.status === "ready") {
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
      }

      // Extract audio from video
      setStatus("extracting");
      const audioData = await extractAudioFromVideo(file);

      // Start transcription - simplified like sample app
      setStatus("transcribing");
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

  const resetTranscription = () => {
    // Reset states
    setError(null);
    setResult(null);
    setStatus("idle");
    setProgress(0);

    // Recreate worker if needed
    if (!worker.current) {
      worker.current = new Worker(
        new URL("../app/worker.ts", import.meta.url),
        {
          type: "module",
        }
      );

      worker.current.addEventListener("message", (e) => {
        switch (e.data.status) {
          case "loading":
            setStatus("loading");
            break;
          case "ready":
            setStatus("ready");
            break;
          case "complete":
            setResult(e.data.result);
            setStatus("ready");
            setProgress(100);
            break;
          case "error":
            setError(e.data.data);
            setStatus("idle");
            setProgress(0);
            break;
          case "progress":
          case "initiate":
          case "download":
          case "done":
            if (e.data.progress !== undefined) {
              setProgress(Math.round(e.data.progress * 100));
            }
            break;
        }
      });
    }
  };

  return {
    status,
    error,
    result,
    progress,
    setResult,
    setStatus,
    setProgress,
    handleVideoSelect,
    resetTranscription,
  };
}
