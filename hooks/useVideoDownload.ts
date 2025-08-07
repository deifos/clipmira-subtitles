import { SubtitleStyle } from "@/components/ui/subtitle-styling";
import { TranscriptionStatus } from "@/hooks/useTranscription";
import { processTranscriptChunks } from "@/lib/utils";
import html2canvas from 'html2canvas';

// Type definitions for VideoFrameCallback API
interface VideoFrameCallbackMetadata {
  presentationTime: DOMHighResTimeStamp;
  mediaTime: number;
  presentedFrames: number;
  processingDuration: number;
  expectedDisplayTime: DOMHighResTimeStamp;
}

declare global {
  interface HTMLVideoElement {
    requestVideoFrameCallback(callback: (now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => void): number;
    cancelVideoFrameCallback(handle: number): void;
  }
}

interface TranscriptionResult {
  text: string;
  chunks: Array<{
    text: string;
    timestamp: [number, number];
    disabled?: boolean;
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
  const handleDownloadVideo = async () => {
    if (!videoRef.current || !videoRef.current.src || !result) {
      console.error("No video source or transcript available");
      return;
    }

    setStatus("processing");
    setProgress(0);
    console.log("Starting video download with exact subtitle matching");

    try {
      // Create a new video element for processing
      const processingVideo = document.createElement('video');
      processingVideo.src = videoRef.current.src;
      processingVideo.crossOrigin = 'anonymous';
      processingVideo.muted = true;
      
      // Wait for video metadata to load
      await new Promise((resolve, reject) => {
        processingVideo.onloadedmetadata = resolve;
        processingVideo.onerror = reject;
      });

      // Create canvas for rendering
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Set canvas dimensions based on ratio - balance quality and file size
      const targetWidth = ratio === '9:16' ? 720 : 1280; // Good quality, reasonable file size
      const targetHeight = ratio === '9:16' ? 1280 : 720;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true;
      console.log(`Video dimensions: ${processingVideo.videoWidth}x${processingVideo.videoHeight}`);
      console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
      console.log(`Video duration: ${processingVideo.duration}s`);

      // Track if capture is active and render timer
      let captureActive = true;
      let renderTimer: NodeJS.Timeout;

      // Setup MediaRecorder with consistent frame rate
      // Explicitly set 30 FPS for better stability
      const stream = canvas.captureStream(); // Fixed 30 FPS for stability
      
      // Add audio from original video if available
      if (processingVideo.captureStream) {
        try {
          const videoStream = processingVideo.captureStream();
          const audioTracks = videoStream.getAudioTracks();
          audioTracks.forEach(track => {
            stream.addTrack(track);
          });
          console.log(`Added ${audioTracks.length} audio tracks`);
        } catch (error) {
          console.warn('Could not capture audio:', error);
        }
      }

      // Optimized quality settings with better audio
      let mediaRecorderOptions;
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mediaRecorderOptions = {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 3000000,
          audioBitsPerSecond: 128000, // Higher audio bitrate
        };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mediaRecorderOptions = {
          mimeType: 'video/webm;codecs=vp8',
          videoBitsPerSecond: 2500000,
          audioBitsPerSecond: 128000,
        };
      } else {
        mediaRecorderOptions = {
          videoBitsPerSecond: 2500000,
          audioBitsPerSecond: 128000,
        };
      }

      const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions);

      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Mark capture as inactive
        captureActive = false;
        
        // Force download if we have data
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          
          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          downloadLink.download = `video_with_subtitles_${Date.now()}.webm`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          
          URL.revokeObjectURL(url);
          setProgress(100);
          setStatus("ready");
          console.log("Video download completed successfully");
        } else {
          console.warn('No data recorded, download skipped');
          setStatus("ready");
          setProgress(0);
        }
      };

      // Render frame function with proper subtitle styling
      const renderFrame = async (currentTime: number) => {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw video frame
        ctx.save();
        
        // Calculate video scaling to fit canvas while maintaining aspect ratio
        const videoAspect = processingVideo.videoWidth / processingVideo.videoHeight;
        const canvasAspect = canvas.width / canvas.height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (videoAspect > canvasAspect) {
          // Video is wider - fit to canvas width
          drawWidth = canvas.width;
          drawHeight = canvas.width / videoAspect;
          offsetX = 0;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          // Video is taller - fit to canvas height
          drawHeight = canvas.height;
          drawWidth = canvas.height * videoAspect;
          offsetX = (canvas.width - drawWidth) / 2;
          offsetY = 0;
        }
        
        ctx.drawImage(processingVideo, offsetX, offsetY, drawWidth, drawHeight);
        ctx.restore();

        // Render subtitles - allow async rendering for html2canvas support
        await renderSubtitles(ctx, currentTime, canvas.width, canvas.height);
      };

      // Try DOM-based rendering first, fall back to canvas rendering
      const renderSubtitles = async (ctx: CanvasRenderingContext2D, currentTime: number, canvasWidth: number, canvasHeight: number) => {
        const processedChunks = processTranscriptChunks(result, mode);
        const enabledChunks = processedChunks.filter(chunk => !chunk.disabled);

        const currentChunks = enabledChunks.filter(
          (chunk) => currentTime >= chunk.timestamp[0] && currentTime <= chunk.timestamp[1]
        );

        if (currentChunks.length === 0) return;

        // Try DOM capture approach if first attempt
        try {
          // Find the subtitle element in the DOM
          const subtitleElement = document.querySelector('.caption-container') as HTMLElement;
      
          if (subtitleElement && captureActive) {
            // Clone and patch the element with current style before capture
            const subtitleClone = subtitleElement.cloneNode(true) as HTMLElement;
            Object.assign(subtitleClone.style, {
              fontSize: `${subtitleStyle.fontSize}px`,
              fontFamily: subtitleStyle.fontFamily,
              color: subtitleStyle.color,
              backgroundColor: subtitleStyle.backgroundColor
            });
            // If we have a subtitle element, capture its exact rendering with html2canvas
            try {
              // Only try to capture if we haven't already failed
              const canvasCapture = await html2canvas(subtitleClone, {
                backgroundColor: null,
                logging: false,
                allowTaint: true,
                useCORS: true,
                scale: 1,  // Use 1:1 scale for accurate sizing
                width: subtitleElement.offsetWidth,
                height: subtitleElement.offsetHeight,
                imageTimeout: 5000  // Add timeout for image loading
              } as any);
              
              // Calculate scale for high-quality rendering
              const scale = Math.max(canvasWidth / 1920, canvasHeight / 1080, 1.5);
              const scaledWidth = canvasCapture.width * scale;
              const scaledHeight = canvasCapture.height * scale;
              
              // Draw the captured subtitles at the correct position with scaling
              const isVerticalVideo = ratio === "9:16";
              const x = (canvasWidth - scaledWidth) / 2;
              const baseY = canvasHeight - (canvasHeight * (isVerticalVideo ? 0.08 : 0.16));
              const y = baseY - scaledHeight;
              
              // Draw the captured subtitle with high quality scaling
              ctx.imageSmoothingEnabled = false;  // Disable smoothing for crisp text
              ctx.drawImage(canvasCapture, x, y, scaledWidth, scaledHeight);
              return; // Exit if DOM capture worked
            } catch (captureError) {
              console.warn('Failed to capture DOM subtitles, falling back to canvas rendering:', captureError);
              captureActive = false; // Don't try again if it failed
            }
          }
        } catch (domError) {
          console.warn('Error with DOM approach, using canvas fallback:', domError);
          captureActive = false;
        }
        
        // Fall back to canvas rendering if DOM capture failed
        const text = currentChunks.map((chunk) => chunk.text).join(" ");
        const isVerticalVideo = ratio === "9:16";
        
        // Find current word for highlighting (phrase mode) with position tracking
        let currentWordInPhrase = null;
        let currentWordIndex = -1;
        if (mode === "phrase" && currentChunks.length > 0) {
          const currentChunk = currentChunks[0];
          if (currentChunk.words) {
            // Find the current word and track its index for accurate positioning
            for (let i = 0; i < currentChunk.words.length; i++) {
              const word = currentChunk.words[i];
              // Check if current time is within this word's timestamp
              if (currentTime >= word.timestamp[0] && currentTime <= word.timestamp[1]) {
                currentWordInPhrase = {
                  ...word,
                  originalIndex: i // Store the original position in the phrase
                };
                currentWordIndex = i;
                break;
              }
            }
          }
        }

        // Text wrapping logic (same as preview component)
        const words = text.split(" ");
        const maxWordsPerLine = isVerticalVideo ? 4 : 6;
        const shouldSplitText = words.length > maxWordsPerLine;
        
        let line1 = text;
        let line2 = "";
        
        if (shouldSplitText) {
          const midpoint = Math.ceil(words.length / 2);
          let splitPoint = midpoint;
          
          for (let i = Math.max(2, midpoint - 2); i <= Math.min(words.length - 2, midpoint + 2); i++) {
            if (/[,;:.!?]$/.test(words[i])) {
              splitPoint = i + 1;
              break;
            }
          }
          
          line1 = words.slice(0, splitPoint).join(" ");
          line2 = words.slice(splitPoint).join(" ");
        }

        // Get the actual preview container size for more accurate scaling
        const previewContainer = document.querySelector('.video-container') as HTMLElement | null;
        const previewWidth = previewContainer?.clientWidth || 800;
        
        // Calculate scale based on video resolution for high quality
        const videoScale = Math.max(canvasWidth / 1920, canvasHeight / 1080, 1);
        const baseScale = Math.max(videoScale * 2.5, canvasWidth / previewWidth, 2); // Higher quality scaling
        
        // Scale font size for better readability in video
        const scaledFontSize = Math.round(subtitleStyle.fontSize * baseScale * 1.2);
        
        // Handle CSS custom properties in font family
        let fontFamily = subtitleStyle.fontFamily;
        if (fontFamily.includes('var(')) {
          const fallbackMatch = fontFamily.match(/,\s*(.+)$/);
          fontFamily = fallbackMatch ? fallbackMatch[1] : 'Arial, sans-serif';
        }
        
        ctx.font = `${subtitleStyle.fontWeight} ${scaledFontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        console.log(`Font: ${ctx.font}, Canvas: ${canvasWidth}x${canvasHeight}, Scale: ${baseScale}`);

        // Position - exactly matching the preview's CSS
        const x = canvasWidth / 2;
        const baseY = canvasHeight - (canvasHeight * (isVerticalVideo ? 0.08 : 0.16));
        
        const lines = shouldSplitText ? [line1, line2] : [text];
        const lineHeight = scaledFontSize * 1.4; // Match preview line spacing
        const totalHeight = lines.length * lineHeight;
        let startY = baseY - totalHeight / 2 + lineHeight / 2;

        // Draw background with exact CSS values
        if (subtitleStyle.backgroundColor && subtitleStyle.backgroundColor !== "transparent") {
          // Use exact CSS values for padding and border radius
          const borderRadius = 8 * baseScale; // Matches rounded-md (8px)
          const paddingX = 12 * baseScale;    // Matches px-3 (12px)
          const paddingY = 8 * baseScale;     // Matches py-2 (8px)
          
          let maxWidth = 0;
          
          // Measure all lines to get the true maximum width
          lines.forEach(line => {
            const metrics = ctx.measureText(line.toUpperCase());
            maxWidth = Math.max(maxWidth, metrics.width);
          });

          // Draw rounded rectangle background to match preview exactly
          ctx.fillStyle = subtitleStyle.backgroundColor;
          
          // Use rounded rectangle for matching CSS border-radius
          ctx.beginPath();
          const bgX = x - maxWidth / 2 - paddingX;
          const bgY = startY - lineHeight / 2 - paddingY;
          const bgWidth = maxWidth + paddingX * 2;
          const bgHeight = totalHeight + paddingY * 2;
          
          // Create rounded rect path
          ctx.moveTo(bgX + borderRadius, bgY);
          ctx.lineTo(bgX + bgWidth - borderRadius, bgY);
          ctx.quadraticCurveTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + borderRadius);
          ctx.lineTo(bgX + bgWidth, bgY + bgHeight - borderRadius);
          ctx.quadraticCurveTo(bgX + bgWidth, bgY + bgHeight, bgX + bgWidth - borderRadius, bgY + bgHeight);
          ctx.lineTo(bgX + borderRadius, bgY + bgHeight);
          ctx.quadraticCurveTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - borderRadius);
          ctx.lineTo(bgX, bgY + borderRadius);
          ctx.quadraticCurveTo(bgX, bgY, bgX + borderRadius, bgY);
          ctx.closePath();
          
          ctx.fill();
        }

        // Draw all text normally first
        lines.forEach((line, index) => {
          const lineY = startY + index * lineHeight;
          renderSimpleLine(ctx, line, x, lineY, scaledFontSize, baseScale);
        });

        // Then apply word highlighting as overlay if enabled
        if (mode === "phrase" && currentWordInPhrase && subtitleStyle.wordHighlightEnabled) {
          // Get all words from the current chunk for accurate positioning
          const allWords = currentChunks[0].words || [];
          renderWordHighlightOverlay(ctx, lines, startY, lineHeight, x, scaledFontSize, currentWordInPhrase, currentTime, baseScale, allWords);
        }
      };

      // Helper function to render a simple line without highlighting
      const renderSimpleLine = (ctx: CanvasRenderingContext2D, line: string, x: number, y: number, fontSize: number, baseScale: number = 1) => {
        // Draw stroke/border - use exact border width from subtitleStyle
        if (subtitleStyle.borderWidth > 0) {
          ctx.strokeStyle = subtitleStyle.borderColor;
          // Scale the border width directly from the style
          ctx.lineWidth = subtitleStyle.borderWidth * baseScale;
          ctx.strokeText(line.toUpperCase(), x, y);
        }

        // Handle CSS property conflict with background vs backgroundColor
        let textFillStyle;
        
        // Draw main text - implement metallic gradient exactly as preview
        if (subtitleStyle.color === "#CCCCCC" || subtitleStyle.color === "#C0C0C0") {
          const textWidth = ctx.measureText(line.toUpperCase()).width;
          const gradient = ctx.createLinearGradient(
            x - textWidth/2, y - fontSize/2, 
            x + textWidth/2, y + fontSize/2
          );
          // Exact gradient stops to match CSS
          gradient.addColorStop(0, "#FFFFFF");
          gradient.addColorStop(0.5, "#CCCCCC");
          gradient.addColorStop(1, "#999999");
          textFillStyle = gradient;
        } else {
          textFillStyle = subtitleStyle.color;
        }
        
        // Apply the text style
        ctx.fillStyle = textFillStyle;
        ctx.fillText(line.toUpperCase(), x, y);
      };

      // Helper function to render word highlight overlay (like the preview)
      const renderWordHighlightOverlay = (
        ctx: CanvasRenderingContext2D, 
        lines: string[], 
        startY: number, 
        lineHeight: number, 
        centerX: number, 
        fontSize: number, 
        currentWord: any, 
        currentTime: number,
        baseScale: number = 1,
        allWords: any[] = []
      ) => {
        if (!currentWord) return;
        
        const currentWordText = currentWord.text.replace(/[^\w]/g, '').toLowerCase();
        const currentWordOriginalIndex = currentWord.originalIndex || -1;
        
        // Build the complete text to match against
        const completeText = allWords.map(w => w.text).join(' ');
        const completeWords = completeText.split(' ');
        
        lines.forEach((line, lineIndex) => {
          const lineY = startY + lineIndex * lineHeight;
          const words = line.split(' ');
          const totalLineWidth = ctx.measureText(line.toUpperCase()).width;
          let wordStartX = centerX - totalLineWidth / 2;
          
          // Calculate word offset for multi-line text
          let wordOffset = 0;
          if (lineIndex > 0) {
            // Count words in all previous lines
            for (let i = 0; i < lineIndex; i++) {
              wordOffset += lines[i].split(' ').length;
            }
          }
          
          // Find which word matches the current spoken word using position
          let highlightedWordIndex = -1;
          for (let i = 0; i < words.length; i++) {
            const absoluteIndex = wordOffset + i;
            const cleanWord = words[i].replace(/[^\w]/g, '').toLowerCase();
            
            // Check if this is the correct word by matching position
            if (absoluteIndex === currentWordOriginalIndex) {
              highlightedWordIndex = i;
              break;
            }
            // Fallback: if position doesn't match exactly, check text and proximity
            else if (cleanWord === currentWordText && 
                     Math.abs(absoluteIndex - currentWordOriginalIndex) <= 1) {
              highlightedWordIndex = i;
              break;
            }
          }
          
          if (highlightedWordIndex === -1) return; // No match found in this line
          
          // Calculate position of the highlighted word more precisely
          for (let i = 0; i < highlightedWordIndex; i++) {
            const word = words[i].toUpperCase();
            const wordWidth = ctx.measureText(word).width;
            const spaceWidth = ctx.measureText(' ').width;
            wordStartX += wordWidth + spaceWidth;
          }
          
          const highlightedWord = words[highlightedWordIndex].toUpperCase();
          const wordWidth = ctx.measureText(highlightedWord).width;
          const wordCenterX = wordStartX + wordWidth / 2;
          
          // Calculate highlight effects - enhanced to match preview exactly
          const intensity = subtitleStyle.wordHighlightIntensity;
          let scale = 1;
          let glowRadius = 0;
          
          switch (subtitleStyle.wordHighlightAnimation) {
            case 'scale':
              scale = 1 + intensity * 0.3;
              break;
            case 'glow':
              // Enhanced glow radius for better visibility in video
              glowRadius = 25 * intensity * Math.max(baseScale, 1.5);
              break;
            case 'pulse':
              const pulseTime = currentTime * 2;
              const pulse = (Math.sin(pulseTime) + 1) / 2;
              // Scale glow radius with baseScale
              glowRadius = 20 * pulse * intensity * baseScale;
              break;
            case 'bounce':
              const bounceTime = currentTime * 3;
              const bounce = Math.abs(Math.sin(bounceTime));
              scale = 1 + bounce * intensity * 0.2;
              break;
          }
          
          ctx.save();
          
          // Apply scaling transform
          if (scale !== 1) {
            ctx.translate(wordCenterX, lineY);
            ctx.scale(scale, scale);
            ctx.translate(-wordCenterX, -lineY);
          }
          
          // Apply enhanced glow/shadow effect for highlighted word
          if (glowRadius > 0) {
            ctx.save();
            ctx.shadowColor = subtitleStyle.wordHighlightColor;
            ctx.shadowBlur = glowRadius;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw multiple glow layers for stronger effect
            for (let i = 0; i < 5; i++) {
              ctx.globalAlpha = 0.8 - (i * 0.15);
              ctx.fillText(highlightedWord, wordCenterX, lineY);
            }
            ctx.restore();
          }
          
          // Draw the highlighted word with the highlight color
          ctx.fillStyle = subtitleStyle.wordHighlightColor;
          ctx.fillText(highlightedWord, wordStartX, lineY);
          
          ctx.restore();
        });
      };

      // Start recording
      mediaRecorder.start(50); // Small timeslices for smoother recording // Smaller chunks for better quality
      
      // Ensure video properties for better sync
      processingVideo.playbackRate = 1.0;
      processingVideo.volume = 1.0; // Make sure volume is at max
      
      // Start video playback
      processingVideo.play();
      console.log('Video playback started, using requestVideoFrameCallback for sync');
      
      // Render loop driven by decoded frames for perfect A/V sync
      let rvfcHandle: number;
      
      const paintFrame = async (_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
        try {
          if (processingVideo.ended || processingVideo.paused) {
            console.log('Video ended, stopping recorder');
            stream.getTracks().forEach(track => track.stop());  // Close all tracks
            mediaRecorder.stop();
            return;
          }
          
          // Render frame synchronously to ensure it's complete before next frame
          await renderFrame(metadata.mediaTime);
          
          // Update progress with fallback if duration is invalid
          const progress = processingVideo.duration > 0 
            ? (metadata.mediaTime / processingVideo.duration) * 100
            : Math.min((metadata.mediaTime / 10) * 100, 95);  // Fallback if no duration
          setProgress(Math.min(progress, 95));
          
          // Schedule next frame
          rvfcHandle = processingVideo.requestVideoFrameCallback(paintFrame);
        } catch (error) {
          console.error('Error in render loop:', error);
          stream.getTracks().forEach(track => track.stop());
          mediaRecorder.stop();
        }
      };
      
      // Ensure we stop cleanly when video ends
      processingVideo.onended = () => {
        console.log('Video ended (onended), stopping recorder');
        if (rvfcHandle) {
          processingVideo.cancelVideoFrameCallback(rvfcHandle);
        }
        stream.getTracks().forEach(track => track.stop());
        mediaRecorder.stop();
      };
      
      // Start the render loop
      rvfcHandle = processingVideo.requestVideoFrameCallback(paintFrame);

      // ---- Remove old timer-based renderLoop ----
      /*const renderLoop = () => {
        const currentTime = processingVideo.currentTime;
        
        if (processingVideo.ended || processingVideo.paused) {
          console.log('Video ended, stopping recording');
          mediaRecorder.stop();
          return;
        }

        // Always render frame on each timer tick for consistent results
        renderFrame(currentTime);
        
        // Update progress
        if (processingVideo.duration > 0) {
          const progress = (currentTime / processingVideo.duration) * 100;
          setProgress(Math.min(progress, 95)); // Leave 5% for final processing
        }
        
        // Fixed 30 FPS timing with setTimeout is more stable than requestAnimationFrame
        */

    } catch (error) {
      console.error("Error downloading video:", error);
      setStatus("ready");
      setProgress(0);
      alert(`Failed to generate video: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return { handleDownloadVideo };
}

