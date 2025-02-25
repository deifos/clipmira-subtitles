import { useState, useRef, useEffect } from "react";
import { extractAudioFromVideo } from "@/lib/audio-utils";

export type TranscriptionStatus =
  | "idle"
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
  uploading: "Uploading video...",
  transcribing: "Transcribing audio...",
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
            } else {
              // Ensure progress is always visible even without specific progress data
              setProgress((prev) => Math.min(85, prev + 1));
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

      // Set up a progress ticker for transcription phase when no progress events
      const lastProgressUpdate = { value: Date.now() };
      const progressTicker = setInterval(() => {
        const now = Date.now();
        // Increase progress more quickly in the first 20 seconds to show activity
        const initialBoost = now - lastProgressUpdate.value > 5000 ? 1 : 0.5;
        lastProgressUpdate.value = now;

        setProgress((prev) => {
          // Boost initial progress to show activity
          if (prev < 60) {
            return Math.min(60, prev + initialBoost);
          } else if (prev >= 85) {
            clearInterval(progressTicker);
            return prev;
          }
          return prev + 0.3;
        });
      }, 1000);

      worker.current.postMessage({
        type: "run",
        data: {
          audio: audioData,
          language: "en",
        },
      });

      // Clear the ticker if component unmounts
      return () => clearInterval(progressTicker);
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
            } else {
              // Ensure progress is always visible
              setProgress((prev) => Math.min(85, prev + 1));
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
