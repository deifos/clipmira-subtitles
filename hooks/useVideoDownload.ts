import { SubtitleStyle } from "@/components/ui/subtitle-styling";
import { TranscriptionStatus } from "@/hooks/useTranscription";

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
}

export function useVideoDownload({
  videoRef,
  result,
  subtitleStyle,
  setStatus,
  setProgress,
}: UseVideoDownloadProps) {
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
                const event = new CustomEvent("timeupdate", {
                  detail: { currentTime: newVideo.currentTime },
                });
                newVideo.dispatchEvent(event);
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

  return { handleDownloadVideo };
}
