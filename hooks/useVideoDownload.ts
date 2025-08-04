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
    let animationId: number | null = null;

    // Function to render a frame with subtitles
    const renderFrame = () => {
      if (!processingVideo || !ctx || !videoRef.current) return;

      // Clear the canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw video frame
      ctx.drawImage(processingVideo, 0, 0, canvas.width, canvas.height);

      // Process chunks according to the current mode
      const processedChunks = processTranscriptChunks(result, mode);

      // Filter out disabled chunks for the downloaded video
      const enabledChunks = processedChunks.filter(chunk => !chunk.disabled);

      // Find current subtitle chunk - use processingVideo time for consistency
      const currentChunks = enabledChunks.filter(
        (chunk) =>
          processingVideo.currentTime >= chunk.timestamp[0] &&
          processingVideo.currentTime <= chunk.timestamp[1]
      );
      
      // Debug subtitle detection every 2 seconds (less spam)
      if (Math.floor(processingVideo.currentTime) % 2 === 0 && Math.floor(processingVideo.currentTime * 10) % 10 === 0) {
        console.log(`Subtitle debug at ${processingVideo.currentTime.toFixed(1)}s: ${currentChunks.length} chunks found`);
        if (currentChunks.length > 0) {
          console.log(`- Current text: "${currentChunks[0].text}"`);
        }
      }
      
      // For phrase mode with word highlighting, find the current word
      let currentWordInPhrase = null;
      if (mode === "phrase" && currentChunks.length > 0 && currentChunks[0].words) {
        currentWordInPhrase = currentChunks[0].words.find(
          (word: any) =>
            processingVideo.currentTime >= word.timestamp[0] &&
            processingVideo.currentTime <= word.timestamp[1]
        );
      }

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

        // Use the exact same positioning as the preview component
        // Preview uses: bottom-[16%] for landscape, bottom-[8%] for portrait
        const bottomPercent = isVerticalVideo ? 0.08 : 0.16;
        const x = canvas.width / 2;
        const y = canvas.height - (canvas.height * bottomPercent);

        // Scale font size to match preview appearance - use the default as reference
        // Default works well at 42px -> 69px, so maintain that ratio for all fonts
        const scaleFactor = 1.64; // 69/42 from working default
        const finalFontSize = Math.round(subtitleStyle.fontSize * scaleFactor);
        
        // Debug logging to see what's happening
        console.log(`Font sizing debug:`);
        console.log(`- Original font size: ${subtitleStyle.fontSize}px`);
        console.log(`- Canvas size: ${canvas.width}x${canvas.height}`);
        console.log(`- Scale factor: ${scaleFactor.toFixed(2)}`);
        console.log(`- Final font size: ${finalFontSize}px`);

        // Set font properties using the final calculated font size
        // Canvas doesn't support CSS custom properties like var(--font-poppins)
        // Extract the fallback font or map to actual font names
        let fontFamily = subtitleStyle.fontFamily;
        if (fontFamily.includes('var(')) {
          // Extract fallback fonts after the comma, or use a safe default
          const fallbackMatch = fontFamily.match(/,\s*(.+)$/);
          fontFamily = fallbackMatch ? fallbackMatch[1] : 'Arial, sans-serif';
          console.log(`Converted CSS custom property font to: ${fontFamily}`);
        }
        
        const fontString = `${subtitleStyle.fontWeight} ${finalFontSize}px ${fontFamily}`;
        ctx.font = fontString;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        console.log(`Font applied: ${fontString}`);
        
        // Enable text rendering optimizations for better quality
        if ('textRendering' in ctx) ctx.textRendering = "optimizeLegibility";
        if ('fontKerning' in ctx) ctx.fontKerning = "normal";
        if ('letterSpacing' in ctx) ctx.letterSpacing = "0.02em";

        // Use normal line spacing like the preview (1.2 is standard)
        let lineHeight = finalFontSize * 1.2;
        let totalTextHeight = nonEmptyLines.length * lineHeight;
        let textStartY = y - totalTextHeight / 2 + lineHeight / 2;

        // Calculate the overall background dimensions for all lines
        let maxWidth = 0;
        nonEmptyLines.forEach((line) => {
          const metrics = ctx.measureText(line);
          maxWidth = Math.max(maxWidth, metrics.width);
        });

        // Use the same width constraints as the preview: 90% for landscape, 85% for portrait
        const maxAllowedWidth = canvas.width * (isVerticalVideo ? 0.85 : 0.9);
        
        // Only scale down font if the text is actually too wide
        // This prevents unnecessary font scaling for shorter text
        if (maxWidth > maxAllowedWidth) {
          console.log(`Text too wide: ${maxWidth}px > ${maxAllowedWidth}px, scaling font down`);
          const scaleFactor = maxAllowedWidth / maxWidth;
          const newFontSize = Math.max(Math.floor(finalFontSize * scaleFactor), 16); // Minimum 16px
          ctx.font = `${subtitleStyle.fontWeight} ${newFontSize}px ${subtitleStyle.fontFamily}`;

          // Recalculate dimensions with new font size
          maxWidth = 0;
          nonEmptyLines.forEach((line) => {
            const metrics = ctx.measureText(line);
            maxWidth = Math.max(maxWidth, metrics.width);
          });
          lineHeight = newFontSize * 1.2;
          totalTextHeight = nonEmptyLines.length * lineHeight;
          textStartY = y - totalTextHeight / 2 + lineHeight / 2;
          
          console.log(`Scaled to ${newFontSize}px, new width: ${maxWidth}px`);
        }

        // Scale padding proportionally to actual font size being used
        const actualFontSize = parseInt(ctx.font.match(/(\d+)px/)?.[1] || finalFontSize.toString());
        const basePaddingRatio = 12 / 24; // 12px padding for 24px font in preview  
        const paddingX = Math.round(actualFontSize * basePaddingRatio);
        const paddingY = Math.round(paddingX * 0.67); // py-2 is typically 2/3 of px-3
        
        console.log(`Padding debug: X=${paddingX}px, Y=${paddingY}px`);
        console.log(`Background: "${subtitleStyle.backgroundColor}", Color: "${subtitleStyle.color}"`);
        console.log(`Max width: ${maxWidth}px, Lines: ${nonEmptyLines.length}`);

        // Draw a single background for all lines
        if (subtitleStyle.backgroundColor && subtitleStyle.backgroundColor !== "transparent") {
          // Apply background with proper opacity handling
          const bgColor = subtitleStyle.backgroundColor;
          
          // Extract opacity from rgba if present, otherwise use full opacity
          let opacity = 1;
          const rgbaMatch = bgColor.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,?\s*([0-9.]+)?\)/i);
          if (rgbaMatch && rgbaMatch[1]) {
            opacity = parseFloat(rgbaMatch[1]);
          }
          
          ctx.fillStyle = bgColor;
          const cornerRadius = Math.round(finalFontSize * 0.2); // Scale corner radius with font size
          const bgX = x - maxWidth / 2 - paddingX;
          const bgY = textStartY - lineHeight / 2 - paddingY;
          const bgWidth = maxWidth + paddingX * 2;
          const bgHeight = totalTextHeight + paddingY * 2;

          ctx.globalAlpha = opacity;
          ctx.beginPath();
          ctx.roundRect(bgX, bgY, bgWidth, bgHeight, cornerRadius);
          ctx.fill();
          ctx.globalAlpha = 1; // Reset alpha
        }

        // Draw each line with word highlighting support
        nonEmptyLines.forEach((line, index) => {
          let lineY = textStartY + index * lineHeight;

          // Regular rendering for both word and phrase modes
          // Draw text border/stroke if specified
          if (subtitleStyle.borderWidth > 0) {
            ctx.fillStyle = subtitleStyle.borderColor;
            const strokeSize = subtitleStyle.borderWidth;

            const strokeOffsets = [
              [-strokeSize, -strokeSize], [0, -strokeSize], [strokeSize, -strokeSize],
              [-strokeSize, 0], [strokeSize, 0],
              [-strokeSize, strokeSize], [0, strokeSize], [strokeSize, strokeSize],
            ];

            strokeOffsets.forEach(([offsetX, offsetY]) => {
              ctx.fillText(line, x + offsetX, lineY + offsetY);
            });
          }

          // Draw the main text with gradient support
          if (subtitleStyle.color === "#CCCCCC" || subtitleStyle.color === "#C0C0C0") {
            // Create metallic gradient like the preview
            const gradient = ctx.createLinearGradient(x - maxWidth/2, lineY - actualFontSize * 0.5, x + maxWidth/2, lineY + actualFontSize * 0.5);
            gradient.addColorStop(0, "#FFFFFF");
            gradient.addColorStop(0.5, "#CCCCCC");
            gradient.addColorStop(1, "#999999");
            ctx.fillStyle = gradient;
          } else {
            ctx.fillStyle = subtitleStyle.color;
          }
          ctx.fillText(line, x, lineY);
        });
      }

      // Don't use requestAnimationFrame here - it conflicts with the setTimeout render loop
      // The renderLoop function handles the timing
      if (processingVideo.ended) {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      }

      // Update progress more frequently with better error handling
      if (processingVideo.duration && processingVideo.duration > 0) {
        const progress = (processingVideo.currentTime / processingVideo.duration) * 100;
        setProgress(Math.min(progress, 100)); // Cap at 100%
        
        // Debug logging every 5 seconds
        if (Math.floor(processingVideo.currentTime) % 5 === 0 && Math.floor(processingVideo.currentTime * 10) % 10 === 0) {
          console.log(`Video progress: ${processingVideo.currentTime.toFixed(1)}s / ${processingVideo.duration.toFixed(1)}s (${progress.toFixed(1)}%)`);
        }
      }
    };

    // Function to start the recording process
    const startRecording = () => {
      // Enable high quality text rendering on the canvas context
      if (ctx) {
        // @ts-ignore - These properties may not be in TypeScript definitions but work in browsers
        if ('textRendering' in ctx) ctx.textRendering = "optimizeLegibility";
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
      }

      // Set up the canvas stream with stable frame rate for MediaRecorder
      const canvasStream = canvas.captureStream(30); // Fixed 30 FPS for stable recording
      
      // Get the audio from the processing video element (not the preview video)
      // This way we don't interfere with the user's preview experience
      if (processingVideo) {
        // The processing video is already muted, but we can capture its stream for audio
        processingVideo.muted = false; // Temporarily unmute only the hidden processing video
        processingVideo.volume = 1.0; // Full volume for audio capture
        
        // Get the audio track from the processing video
        const videoElement = processingVideo as HTMLVideoElement & {
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
      // Try different codec combinations for better compatibility
      let mimeType: string;
      let recordingOptions: MediaRecorderOptions;

      if (MediaRecorder.isTypeSupported("video/mp4;codecs=h264,aac")) {
        mimeType = "video/mp4;codecs=h264,aac";
        recordingOptions = {
          mimeType,
          videoBitsPerSecond: 5_000_000, // 5 Mbps for better compatibility
          audioBitsPerSecond: 128_000, // 128 kbps for audio
        };
      } else if (MediaRecorder.isTypeSupported("video/mp4")) {
        mimeType = "video/mp4";
        recordingOptions = {
          mimeType,
          videoBitsPerSecond: 5_000_000,
          audioBitsPerSecond: 128_000,
        };
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
        mimeType = "video/webm;codecs=vp9,opus";
        recordingOptions = {
          mimeType,
          videoBitsPerSecond: 4_000_000, // Lower bitrate for VP9
          audioBitsPerSecond: 128_000,
        };
      } else {
        // Fallback to basic WebM
        mimeType = "video/webm";
        recordingOptions = {
          mimeType,
          videoBitsPerSecond: 3_000_000,
          audioBitsPerSecond: 128_000,
        };
      }

      console.log(`Using codec: ${mimeType}`);
      mediaRecorder = new MediaRecorder(canvasStream, recordingOptions);

      const recordingInterval = 500; // Record in 0.5-second chunks for better quality

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      // Add error handling for MediaRecorder
      mediaRecorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        cleanup();
      };

      // Set up cleanup when recording stops
      mediaRecorder.onstop = () => {
        // Create a blob from the recorded chunks with proper MIME type and codecs
        const blob = new Blob(chunks, { type: mimeType });

        // Create download link with timestamp in filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const extension = mimeType.includes("mp4") ? "mp4" : "webm";
        a.download = `video_with_subtitles_${timestamp}.${extension}`;
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

        // Play both videos with a small delay to ensure sync
        const playPromises = [
          videoRef.current.play().then(() => {
            console.log(`Main video playing from ${videoRef.current?.currentTime}s`);
          }),
          processingVideo.play().then(() => {
            console.log(`Processing video playing from ${processingVideo.currentTime}s`);
          })
        ];

        Promise.all(playPromises)
          .then(() => {
            // Use stable interval-based rendering to avoid MediaRecorder issues
            const renderLoop = () => {
              // Check if video has ended or if there's an error
              if (processingVideo.ended || processingVideo.error) {
                console.log('Video ended or error occurred, stopping recording');
                if (mediaRecorder && mediaRecorder.state !== "inactive") {
                  mediaRecorder.stop();
                }
                return;
              }
              
              // Check if video is still playing
              if (processingVideo.paused && !processingVideo.ended) {
                console.log('Video paused unexpectedly, attempting to resume');
                processingVideo.play().catch(console.error);
              }

              renderFrame();
              
              // Use stable 30 FPS interval that works well with MediaRecorder
              setTimeout(renderLoop, 1000 / 30); // 30 FPS is stable for recording
            };

            // Start the render loop
            renderLoop();

            // Keep videos in sync with better error handling
            const syncInterval = setInterval(() => {
              if (processingVideo.ended || videoRef.current?.ended) {
                clearInterval(syncInterval);
                return;
              }
              
              // Check if videos are still playing and in sync
              if (videoRef.current && !videoRef.current.paused && !processingVideo.paused) {
                const timeDiff = Math.abs(processingVideo.currentTime - videoRef.current.currentTime);
                if (timeDiff > 0.2) { // Allow slightly more tolerance
                  console.log(`Syncing videos: processing=${processingVideo.currentTime.toFixed(2)}, main=${videoRef.current.currentTime.toFixed(2)}`);
                  processingVideo.currentTime = videoRef.current.currentTime;
                }
              }
            }, 200); // Less frequent sync to reduce overhead
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

    // Pre-load fonts to ensure they're available for video rendering before starting
    if (typeof document !== 'undefined') {
      // Add a tiny span with the font to ensure it's loaded
      const fontPreloader = document.createElement('span');
      fontPreloader.style.fontFamily = subtitleStyle.fontFamily;
      fontPreloader.style.fontSize = '0px';
      fontPreloader.style.visibility = 'hidden';
      fontPreloader.textContent = 'Font preloader';
      document.body.appendChild(fontPreloader);
      
      // Wait for the font to load, then clean it up
      setTimeout(() => {
        if (document.body.contains(fontPreloader)) {
          document.body.removeChild(fontPreloader);
        }
      }, 100);
    }
    
    // Wait for the processing video to load before starting
    processingVideo.onloadedmetadata = startRecording;
    processingVideo.onerror = cleanup;
  };

  return { handleDownloadVideo };
}
