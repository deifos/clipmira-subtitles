import { SubtitleStyle } from "@/components/ui/subtitle-styling";
import { TranscriptionStatus } from "@/hooks/useTranscription";
import { processTranscriptChunks } from "@/lib/utils";

interface TranscriptionResult {
  text: string;
  chunks: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}

interface UseVideoDownloadProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  result: TranscriptionResult | null;
  subtitleStyle: SubtitleStyle;
  setStatus: (status: TranscriptionStatus) => void;
  setProgress: (progress: number) => void;
  mode: "word" | "phrase";
  ratio: "16:9" | "9:16";
}

export function useVideoDownload({
  videoRef,
  result,
  subtitleStyle,
  setStatus,
  setProgress,
  mode,
  ratio,
}: UseVideoDownloadProps) {
  const handleDownloadVideo = () => {
    if (!videoRef.current || !videoRef.current.src || !result) {
      console.error("No video source or transcript available");
      return;
    }

    // Store the original video source and state
    const originalSrc = videoRef.current.src;
    const originalCurrentTime = videoRef.current.currentTime;
    const originalVolume = videoRef.current.volume;
    const originalMuted = videoRef.current.muted;

    setStatus("processing");
    setProgress(0);

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

    // Create a temporary video element for visual processing only
    const processingVideo = document.createElement("video");
    processingVideo.src = originalSrc;
    processingVideo.muted = true;
    processingVideo.crossOrigin = "anonymous";
    processingVideo.style.display = "none";
    document.body.appendChild(processingVideo);

    // We'll use the original video for audio, but we'll hide it from the user
    // Store original styles to restore later
    const originalStyle = videoRef.current.style.cssText;

    // Hide the original video but keep it playing for audio
    videoRef.current.style.opacity = "0";
    videoRef.current.style.position = "absolute";
    videoRef.current.style.zIndex = "-1000";
    videoRef.current.style.pointerEvents = "none";

    // Prepare for recording
    let mediaRecorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    let lastDrawTime = 0;
    const frameInterval = 1000 / 30; // 30 FPS

    // Function to render a frame with subtitles
    const renderFrame = (timestamp: number) => {
      if (!processingVideo || !ctx || !videoRef.current) return;

      // Skip frames if not enough time has passed
      if (timestamp - lastDrawTime < frameInterval) {
        requestAnimationFrame(renderFrame);
        return;
      }

      lastDrawTime = timestamp;

      // Clear the canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw video frame
      ctx.drawImage(processingVideo, 0, 0, canvas.width, canvas.height);

      // Process chunks according to the current mode
      const processedChunks = processTranscriptChunks(result, mode);

      // Find current subtitle chunk - use processingVideo time for consistency
      const currentChunks = processedChunks.filter(
        (chunk) =>
          processingVideo.currentTime >= chunk.timestamp[0] &&
          processingVideo.currentTime <= chunk.timestamp[1]
      );

      if (currentChunks.length > 0) {
        // Get combined text
        const text = currentChunks.map((chunk) => chunk.text).join(" ");

        // Calculate aspect ratio and adjust positioning accordingly
        const isVerticalVideo = ratio === "9:16";

        // Adjust text splitting based on aspect ratio and text length
        const words = text.split(" ");
        const midpoint = Math.ceil(words.length / 2);

        // For landscape videos, use more aggressive text splitting for longer text
        const shouldSplitText =
          isVerticalVideo || (ratio === "16:9" && words.length > 6);

        // Create lines of text - for landscape with long text, split into more lines if needed
        let lines;
        if (shouldSplitText) {
          if (ratio === "16:9" && words.length > 12) {
            // For very long text in landscape, split into 3 lines
            const third = Math.ceil(words.length / 3);
            lines = [
              words.slice(0, third).join(" "),
              words.slice(third, third * 2).join(" "),
              words.slice(third * 2).join(" "),
            ];
          } else {
            // Standard 2-line split
            lines = [
              words.slice(0, midpoint).join(" "),
              words.slice(midpoint).join(" "),
            ];
          }
        } else {
          lines = [text];
        }

        // Filter out empty lines
        const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

        if (nonEmptyLines.length === 0) return;

        // Calculate position (centered at bottom with padding)
        const paddingPercent = isVerticalVideo ? 0.08 : 0.16;
        const padding = Math.round(canvas.height * paddingPercent);
        const x = canvas.width / 2;
        const y = canvas.height - padding;

        // Scale font size based on video dimensions, aspect ratio, and text length
        let baseFontSize;
        if (isVerticalVideo) {
          // Vertical video (9:16)
          baseFontSize = Math.min(canvas.width * 0.045, canvas.height * 0.025);
        } else {
          // Landscape video (16:9) - adjust size based on text length
          const textLengthFactor = Math.max(0.7, 1 - words.length / 50); // Reduce size for longer text
          baseFontSize = Math.round(canvas.height * 0.04 * textLengthFactor);
        }

        const fontSizeScaled = Math.max(
          Math.min(subtitleStyle.fontSize, 24), // Cap at 24px for downloaded videos
          baseFontSize
        );

        // Set font properties
        ctx.font = `${subtitleStyle.fontWeight} ${fontSizeScaled}px ${subtitleStyle.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Calculate total height for all lines
        let lineHeight = fontSizeScaled * 1.2;
        let totalTextHeight = nonEmptyLines.length * lineHeight;
        let textStartY = y - totalTextHeight / 2 + lineHeight / 2;

        // Calculate the overall background dimensions for all lines
        let maxWidth = 0;
        nonEmptyLines.forEach((line) => {
          const metrics = ctx.measureText(line);
          maxWidth = Math.max(maxWidth, metrics.width);
        });

        // Ensure text doesn't exceed video width
        const maxAllowedWidth = canvas.width * (isVerticalVideo ? 0.85 : 0.9);
        if (maxWidth > maxAllowedWidth) {
          // Reduce font size to fit
          const scaleFactor = maxAllowedWidth / maxWidth;
          const newFontSize = Math.floor(fontSizeScaled * scaleFactor);
          ctx.font = `${subtitleStyle.fontWeight} ${newFontSize}px ${subtitleStyle.fontFamily}`;

          // Recalculate dimensions with new font size
          maxWidth = maxAllowedWidth;
          lineHeight = newFontSize * 1.2;
          totalTextHeight = nonEmptyLines.length * lineHeight;
          textStartY = y - totalTextHeight / 2 + lineHeight / 2;
        }

        const paddingX = fontSizeScaled * 0.8;
        const paddingY = fontSizeScaled * 0.5;

        // Draw a single background for all lines
        if (subtitleStyle.backgroundColor) {
          ctx.fillStyle = subtitleStyle.backgroundColor;
          const cornerRadius = 8;
          const bgX = x - maxWidth / 2 - paddingX;
          const bgY = textStartY - lineHeight / 2 - paddingY;
          const bgWidth = maxWidth + paddingX * 2;
          const bgHeight = totalTextHeight + paddingY * 2;

          ctx.beginPath();
          ctx.roundRect(bgX, bgY, bgWidth, bgHeight, cornerRadius);
          ctx.fill();
        }

        // Draw each line
        nonEmptyLines.forEach((line, index) => {
          const lineY = textStartY + index * lineHeight;

          // Draw text border/stroke if specified
          if (subtitleStyle.borderWidth > 0) {
            ctx.fillStyle = subtitleStyle.borderColor;
            const strokeSize = subtitleStyle.borderWidth;

            const strokeOffsets = [
              [-strokeSize, -strokeSize],
              [strokeSize, -strokeSize],
              [-strokeSize, strokeSize],
              [strokeSize, strokeSize],
            ];

            strokeOffsets.forEach(([offsetX, offsetY]) => {
              ctx.fillText(line, x + offsetX, lineY + offsetY);
            });
          }

          // Draw the main text
          ctx.fillStyle = subtitleStyle.color;
          ctx.fillText(line, x, lineY);
        });
      }

      // Continue rendering if video is still playing
      if (!processingVideo.paused && !processingVideo.ended) {
        requestAnimationFrame(renderFrame);
      } else if (processingVideo.ended) {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      }

      // Update progress more frequently
      const progress =
        (processingVideo.currentTime / processingVideo.duration) * 100;
      setProgress(progress);
    };

    // Function to start the recording process
    const startRecording = () => {
      // Set up the canvas stream with proper timing
      const canvasStream = canvas.captureStream();

      // Get the audio from the original video element
      if (videoRef.current) {
        // Unmute the original video but keep volume low for the user
        videoRef.current.muted = false;
        videoRef.current.volume = 0.01; // Very low volume, almost silent

        // Get the audio track from the original video
        const videoElement = videoRef.current as HTMLVideoElement & {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        };

        const audioTracks =
          videoElement.captureStream?.() ||
          videoElement.mozCaptureStream?.() ||
          null;

        if (audioTracks && audioTracks.getAudioTracks().length > 0) {
          // Add audio tracks to the canvas stream
          audioTracks.getAudioTracks().forEach((track: MediaStreamTrack) => {
            canvasStream.addTrack(track.clone());
          });
        } else {
          console.warn("Could not capture audio tracks from video");
        }
      }

      // Create a MediaRecorder with the combined stream
      mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: "video/webm",
        videoBitsPerSecond: 3500000, // 3.5 Mbps for good quality
      });

      let startTime: number | null = null;
      const recordingInterval = 100; // Record in smaller chunks for better seeking

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      // Set up cleanup when recording stops
      mediaRecorder.onstop = () => {
        // Create a blob from the recorded chunks with proper MIME type
        const blob = new Blob(chunks, {
          type: "video/webm",
        });

        // Create download link with timestamp in filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `video_with_subtitles_${timestamp}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Clean up
        URL.revokeObjectURL(a.href);
        document.body.removeChild(processingVideo);

        // Restore the original video state
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = originalCurrentTime;
          videoRef.current.volume = originalVolume;
          videoRef.current.muted = originalMuted;
          videoRef.current.style.cssText = originalStyle;
        }

        setStatus("ready");
        setProgress(100);
      };

      // Start recording in smaller chunks for better seeking
      mediaRecorder.start(recordingInterval);

      // Start both videos
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        processingVideo.currentTime = 0;

        // Play both videos
        const playPromises = [videoRef.current.play(), processingVideo.play()];

        Promise.all(playPromises)
          .then(() => {
            // Start rendering frames with timing information
            const render = (timestamp: number) => {
              if (startTime === null) {
                startTime = timestamp;
              }

              renderFrame(timestamp - startTime);

              if (!processingVideo.ended) {
                requestAnimationFrame(render);
              } else if (mediaRecorder && mediaRecorder.state !== "inactive") {
                mediaRecorder.stop();
              }
            };

            requestAnimationFrame(render);

            // Keep videos in sync
            const syncInterval = setInterval(() => {
              if (processingVideo.ended || videoRef.current?.ended) {
                clearInterval(syncInterval);
                return;
              }
              if (
                Math.abs(
                  processingVideo.currentTime - videoRef.current!.currentTime
                ) > 0.1
              ) {
                processingVideo.currentTime = videoRef.current!.currentTime;
              }
            }, 100); // Sync more frequently
          })
          .catch((error) => {
            console.error("Error playing videos:", error);
            cleanup();
          });
      }
    };

    // Function to clean up resources on error
    const cleanup = () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      } else {
        // If mediaRecorder wasn't started, do manual cleanup
        document.body.removeChild(processingVideo);

        // Restore the original video state
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = originalCurrentTime;
          videoRef.current.volume = originalVolume;
          videoRef.current.muted = originalMuted;
          videoRef.current.style.cssText = originalStyle;
        }

        setStatus("ready");
        setProgress(100);
      }
    };

    // Wait for the processing video to load before starting
    processingVideo.onloadedmetadata = startRecording;
    processingVideo.onerror = cleanup;
  };

  return { handleDownloadVideo };
}
