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
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    if (!videoRef.current || !videoRef.current.src || !result) {
      console.error("No video source or transcript available");
      return;
    }

    // Store the original video source to restore it later
    const originalSrc = videoRef.current.src;
    const originalCurrentTime = videoRef.current.currentTime;
    const originalPaused = videoRef.current.paused;

    setStatus("transcribing");
    setProgress(50);

    // Create canvas and context for rendering
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Could not get canvas context");
      setStatus("idle");
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    // Create audio context to capture audio
    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();

    // Get the video's audio track
    const videoElement = videoRef.current;
    const audioSource = audioCtx.createMediaElementSource(videoElement);
    audioSource.connect(destination);
    audioSource.connect(audioCtx.destination); // Also connect to speakers

    // Combine video stream from canvas with audio stream
    const videoStream = canvas.captureStream(30); // 30 FPS
    const audioTracks = destination.stream.getAudioTracks();
    audioTracks.forEach((track) => {
      videoStream.addTrack(track);
    });

    // Create a MediaRecorder with the combined stream
    const mediaRecorder = new MediaRecorder(videoStream, {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 5000000, // 5 Mbps
    });

    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      // Create a blob from the recorded chunks
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);

      // Create download link
      const a = document.createElement("a");
      a.href = url;
      a.download = "video_with_subtitles.webm";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up
      URL.revokeObjectURL(url);

      // Close audio context
      audioCtx.close();

      // Properly restore the original video
      if (videoRef.current) {
        // Disconnect the audio source to prevent errors
        try {
          audioSource.disconnect();
        } catch (e) {
          console.log("Error disconnecting audio source:", e);
        }

        // Create a new video element to clone the original source
        const tempVideo = document.createElement("video");
        tempVideo.crossOrigin = "anonymous";
        tempVideo.src = originalSrc;

        // Wait for the temp video to be ready
        tempVideo.onloadeddata = () => {
          if (videoRef.current) {
            // Completely recreate the video element to avoid any issues
            const videoParent = videoRef.current.parentNode;
            if (videoParent) {
              // Create a new video element
              const newVideo = document.createElement("video");
              newVideo.src = originalSrc;
              newVideo.controls = videoRef.current.controls;
              newVideo.className = videoRef.current.className;
              newVideo.crossOrigin = "anonymous";
              newVideo.style.cssText = videoRef.current.style.cssText;

              // Replace the old video with the new one
              videoParent.replaceChild(newVideo, videoRef.current);

              // Update the ref
              videoRef.current = newVideo;

              // Set the current time and play state
              newVideo.currentTime = originalCurrentTime;
              if (!originalPaused) {
                newVideo
                  .play()
                  .catch((e) => console.error("Error playing video:", e));
              }

              // Reattach the timeupdate event
              newVideo.ontimeupdate = () => {
                setCurrentTime(newVideo.currentTime);
              };
            }
          }
        };

        // Handle any errors
        tempVideo.onerror = () => {
          console.error("Error loading original video source");
          setStatus("ready");
          setProgress(100);
        };
      }

      setStatus("ready");
      setProgress(100);
    };

    // Start recording
    mediaRecorder.start(1000); // Collect data every second

    // Reset video to beginning
    videoRef.current.currentTime = 0;
    videoRef.current.volume = 1; // Ensure volume is up

    // Function to render a frame with subtitles
    const renderFrame = () => {
      if (!videoRef.current || !ctx) return;

      // Clear the canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw video frame
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      // Find current subtitle chunk
      const currentChunks = result.chunks.filter(
        (chunk) =>
          videoRef.current!.currentTime >= chunk.timestamp[0] &&
          videoRef.current!.currentTime <= chunk.timestamp[1]
      );

      if (currentChunks.length > 0) {
        // Get combined text
        const text = currentChunks.map((chunk) => chunk.text).join(" ");

        // Calculate position (centered at bottom with padding)
        // Adjust padding to match the preview's position (bottom-16 class)
        const padding = Math.round(canvas.height * 0.16); // 16% of height, similar to bottom-16
        const x = canvas.width / 2;
        const y = canvas.height - padding;

        // Apply subtitle styling - exactly match the preview
        // Scale font size based on video dimensions to match preview appearance
        const fontSizeScaled = Math.max(
          subtitleStyle.fontSize,
          Math.round(canvas.height * 0.04)
        ); // Ensure minimum readable size

        // Set font properties
        ctx.font = `${subtitleStyle.fontWeight} ${fontSizeScaled}px ${subtitleStyle.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Measure text for background
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = fontSizeScaled * 1.5; // Increase height for better padding

        // Add padding around text (similar to px-4 py-2 in the preview)
        const paddingX = fontSizeScaled * 0.8; // Horizontal padding
        const paddingY = fontSizeScaled * 0.5; // Vertical padding

        // Draw subtitle background with rounded corners if specified
        if (subtitleStyle.backgroundColor) {
          ctx.fillStyle = subtitleStyle.backgroundColor;

          // Draw rounded rectangle for background (similar to rounded-md in preview)
          const cornerRadius = 8; // Similar to rounded-md
          const bgX = x - textWidth / 2 - paddingX;
          const bgY = y - textHeight / 2 - paddingY;
          const bgWidth = textWidth + paddingX * 2;
          const bgHeight = textHeight + paddingY * 2;

          // Draw rounded rectangle
          ctx.beginPath();
          ctx.moveTo(bgX + cornerRadius, bgY);
          ctx.lineTo(bgX + bgWidth - cornerRadius, bgY);
          ctx.quadraticCurveTo(
            bgX + bgWidth,
            bgY,
            bgX + bgWidth,
            bgY + cornerRadius
          );
          ctx.lineTo(bgX + bgWidth, bgY + bgHeight - cornerRadius);
          ctx.quadraticCurveTo(
            bgX + bgWidth,
            bgY + bgHeight,
            bgX + bgWidth - cornerRadius,
            bgY + bgHeight
          );
          ctx.lineTo(bgX + cornerRadius, bgY + bgHeight);
          ctx.quadraticCurveTo(
            bgX,
            bgY + bgHeight,
            bgX,
            bgY + bgHeight - cornerRadius
          );
          ctx.lineTo(bgX, bgY + cornerRadius);
          ctx.quadraticCurveTo(bgX, bgY, bgX + cornerRadius, bgY);
          ctx.closePath();
          ctx.fill();
        }

        // Draw text border/stroke if specified
        if (subtitleStyle.borderWidth > 0) {
          // Implement text-shadow effect similar to the preview
          // Draw the text multiple times with offsets to create an outline effect
          ctx.fillStyle = subtitleStyle.borderColor;
          const strokeSize = subtitleStyle.borderWidth;

          // Draw text at multiple offsets to create outline effect
          [
            [-strokeSize, -strokeSize],
            [strokeSize, -strokeSize],
            [-strokeSize, strokeSize],
            [strokeSize, strokeSize],
            [0, -strokeSize],
            [0, strokeSize],
            [-strokeSize, 0],
            [strokeSize, 0],
          ].forEach(([offsetX, offsetY]) => {
            ctx.fillText(text, x + offsetX, y + offsetY);
          });
        }

        // Draw the main text
        ctx.fillStyle = subtitleStyle.color;
        ctx.fillText(text, x, y);
      }

      // Continue rendering if video is still playing
      if (!videoRef.current.paused && !videoRef.current.ended) {
        requestAnimationFrame(renderFrame);
      } else if (videoRef.current.ended) {
        mediaRecorder.stop();
      }
    };

    // Start playback and rendering
    videoRef.current
      .play()
      .then(() => {
        renderFrame();

        // Update progress based on video time
        const progressInterval = setInterval(() => {
          if (!videoRef.current) {
            clearInterval(progressInterval);
            return;
          }

          const progress =
            (videoRef.current.currentTime / videoRef.current.duration) * 100;
          setProgress(50 + progress * 0.5); // Scale to 50-100 range

          if (videoRef.current.ended) {
            clearInterval(progressInterval);
          }
        }, 500);

        // Set a timeout to stop recording if video doesn't end naturally
        const safetyTimeout = setTimeout(() => {
          if (mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            clearInterval(progressInterval);
          }
        }, (videoRef.current?.duration || 0) * 1000 + 5000); // Video duration + 5 seconds buffer

        // Clean up on video end
        if (videoRef.current) {
          videoRef.current.onended = () => {
            clearTimeout(safetyTimeout);
            clearInterval(progressInterval);
            if (mediaRecorder.state === "recording") {
              mediaRecorder.stop();
            }
          };
        }
      })
      .catch((error) => {
        console.error("Error playing video for rendering:", error);

        // Disconnect the audio source to prevent errors
        try {
          audioSource.disconnect();
        } catch (e) {
          console.log("Error disconnecting audio source:", e);
        }

        // Restore the original video state on error
        if (videoRef.current) {
          videoRef.current.src = originalSrc;
          videoRef.current.currentTime = originalCurrentTime;
          if (!originalPaused) {
            videoRef.current
              .play()
              .catch((e) => console.error("Error playing video:", e));
          }
        }

        setStatus("idle");
        setProgress(0);
      });
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

        {/* <div className="not-prose flex w-full items-center justify-center z-[15] relative border-2 mb-5 border-border dark:border-darkBorder bg-white dark:bg-secondaryBlack bg-[radial-gradient(#80808080_1px,transparent_1px)] px-10 py-20 shadow-light dark:shadow-dark [background-size:16px_16px] m750:px-5 m750:py-10"></div> */}

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
