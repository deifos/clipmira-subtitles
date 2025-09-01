import { useState, useCallback } from 'react';
import {
  Input,
  Output,
  CanvasSource,
  AudioBufferSource,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  BlobSource,
  VideoSampleSink,
  ALL_FORMATS,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_LOW,
  QUALITY_VERY_HIGH
} from 'mediabunny';

// Types
interface TranscriptChunk {
  text: string;
  timestamp: [number, number];
  disabled?: boolean;
}

interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  dropShadowIntensity: number;
}

interface UseVideoDownloadMediaBunnyV2Props {
  video: HTMLVideoElement | null;
  transcriptChunks: TranscriptChunk[];
  subtitleStyle: SubtitleStyle;
  mode: 'word' | 'phrase';
  format?: 'mp4' | 'webm';
  quality?: 'low' | 'medium' | 'high' | 'very_high';
  fps?: number;
}

const qualityMap = {
  low: QUALITY_LOW,
  medium: QUALITY_MEDIUM,
  high: QUALITY_HIGH,
  very_high: QUALITY_VERY_HIGH,
};

export function useVideoDownloadMediaBunnyV2({
  video,
  transcriptChunks,
  subtitleStyle,
  mode,
  format = 'mp4',
  quality = 'high',
  fps = 30
}: UseVideoDownloadMediaBunnyV2Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');

  const downloadVideo = useCallback(async () => {
    if (!video || !video.src || transcriptChunks.length === 0) {
      console.error('Missing video or transcript data');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatus('Initializing MediaBunny...');

    try {
      // Create canvas for subtitle rendering
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to create canvas context');
      }

      console.log(`Canvas size: ${canvas.width}x${canvas.height}`);

      // Setup MediaBunny input for original video
      setStatus('Reading original video...');
      const videoBlob = await fetch(video.src).then(r => r.blob());
      const input = new Input({
        source: new BlobSource(videoBlob),
        formats: ALL_FORMATS,
      });

      // Get video metadata and tracks
      const duration = await input.computeDuration();
      const originalVideoTrack = await input.getPrimaryVideoTrack();
      const originalAudioTrack = await input.getPrimaryAudioTrack();

      console.log(`Video duration: ${duration}s`);
      if (originalVideoTrack) {
        console.log(`Original resolution: ${originalVideoTrack.displayWidth}x${originalVideoTrack.displayHeight}`);
      }

      // Setup output format
      const outputFormat = format === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat();
      
      const output = new Output({
        format: outputFormat,
        target: new BufferTarget(),
      });

      // Create canvas source for video with subtitles
      const videoSource = new CanvasSource(canvas, {
        codec: format === 'webm' ? 'vp9' : 'avc',
        bitrate: qualityMap[quality],
      });

      output.addVideoTrack(videoSource, { frameRate: fps });

      // Handle audio if present
      let audioSource: AudioBufferSource | null = null;
      let audioBuffer: AudioBuffer | null = null;

      if (originalAudioTrack) {
        setStatus('Processing audio...');
        
        // Decode audio
        try {
          const arrayBuffer = await videoBlob.arrayBuffer();
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
          
          audioSource = new AudioBufferSource({
            codec: format === 'webm' ? 'opus' : 'aac',
            bitrate: qualityMap[quality],
          });

          output.addAudioTrack(audioSource);
        } catch (error) {
          console.warn('Audio processing failed:', error);
          // Continue without audio
        }
      }

      // Start the output (after all tracks are added)
      await output.start();

      // Add audio data after starting
      if (audioSource && audioBuffer) {
        await audioSource.add(audioBuffer);
        audioSource.close();
      }

      // Setup video sample sink for frame-by-frame processing
      let videoSampleSink: VideoSampleSink | null = null;
      if (originalVideoTrack) {
        const canDecode = await originalVideoTrack.canDecode();
        if (canDecode) {
          videoSampleSink = new VideoSampleSink(originalVideoTrack);
        }
      }

      // Filter enabled chunks
      const enabledChunks = transcriptChunks.filter(chunk => !chunk.disabled);
      console.log(`Processing ${enabledChunks.length} subtitle chunks`);

      const totalFrames = Math.ceil(duration * fps);
      let cancelled = false;

      setStatus('Rendering video frames...');

      // Render each frame systematically
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        const time = frameIndex / fps;
        
        // Update progress
        const progressPercent = (frameIndex / totalFrames);
        setProgress(progressPercent);
        setStatus(`Rendering: ${Math.round(time)}s / ${Math.round(duration)}s (${Math.round(progressPercent * 100)}%)`);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw video frame if available
        if (videoSampleSink) {
          try {
            const sample = await videoSampleSink.getSample(time);
            if (sample) {
              // Draw the video frame to fill the canvas
              sample.draw(ctx, 0, 0, canvas.width, canvas.height);
            }
          } catch (error) {
            console.warn(`Failed to get video sample at time ${time}:`, error);
          }
        }

        // Find and render current subtitle
        const currentChunk = enabledChunks.find(chunk => {
          const start = chunk.timestamp[0];
          const end = chunk.timestamp[1];
          return time >= start && time <= end;
        });

        if (currentChunk) {
          renderSubtitleOnCanvas(ctx, currentChunk, subtitleStyle, canvas, time, mode, enabledChunks);
        }

        // Add frame to video source with precise timing
        const frameDuration = 1 / fps;
        await videoSource.add(time, frameDuration);
      }

      if (cancelled) {
        await output.cancel();
        return;
      }

      // Close video source and finalize
      videoSource.close();
      setStatus('Finalizing video...');
      await output.finalize();

      // Get the final buffer
      const bufferTarget = output.target as BufferTarget;
      const buffer = bufferTarget.buffer;

      if (!buffer) {
        throw new Error('Failed to generate video buffer');
      }

      // Create and download the file
      const mimeType = format === 'webm' ? 'video/webm' : 'video/mp4';
      const blob = new Blob([buffer], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `video_with_subtitles_${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      setStatus('Export complete!');
      setProgress(1);
      console.log('Video export completed successfully');

    } catch (error) {
      console.error('MediaBunny video processing failed:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      // Don't reset progress immediately so user can see completion
      setTimeout(() => setProgress(0), 3000);
    }
  }, [video, transcriptChunks, subtitleStyle, mode, format, quality, fps]);

  return {
    downloadVideo,
    isProcessing,
    progress,
    status
  };
}

// Subtitle rendering function adapted from our working preview code
function renderSubtitleOnCanvas(
  ctx: CanvasRenderingContext2D,
  chunk: TranscriptChunk,
  style: SubtitleStyle,
  canvas: HTMLCanvasElement,
  currentTime: number,
  mode: 'word' | 'phrase',
  allChunks: TranscriptChunk[]
) {
  // Get the text to display
  let displayText = '';
  
  if (mode === 'word') {
    displayText = chunk.text;
  } else {
    // For phrase mode, use the chunk text
    displayText = chunk.text;
  }

  // Calculate font size to match preview proportions exactly
  const isVerticalVideo = canvas.height > canvas.width;

  // Get the actual preview container dimensions
  const previewContainer = document.querySelector('.video-container') as HTMLElement | null;
  const previewWidth = previewContainer?.clientWidth || 281;  // Use actual preview size
  const previewHeight = previewContainer?.clientHeight || 500;
  
  // Calculate scale based on the ratio between export resolution and preview resolution
  const scaleX = canvas.width / previewWidth;
  const scaleY = canvas.height / previewHeight;
  const baseScale = Math.min(scaleX, scaleY); // Use the smaller scale to maintain proportions
  
  // Apply the same font size as preview, just scaled to match resolution difference
  const finalFontSize = Math.round(style.fontSize * baseScale);
  
  console.log(`Preview: ${previewWidth}x${previewHeight}, Export: ${canvas.width}x${canvas.height}`);
  console.log(`Font calculation: fontSize=${style.fontSize}, baseScale=${baseScale}, final=${finalFontSize}`);

  // Handle CSS custom properties in font family (from working preview)
  let fontFamily = style.fontFamily;
  if (fontFamily.includes('var(')) {
    const fallbackMatch = fontFamily.match(/,\s*(.+)$/);
    fontFamily = fallbackMatch ? fallbackMatch[1] : 'Arial, sans-serif';
  }

  // Set font properties
  ctx.font = `${style.fontWeight} ${finalFontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Calculate positioning using EXACT same logic as working preview
  const x = canvas.width / 2;
  const baseY = canvas.height - (canvas.height * (isVerticalVideo ? 0.08 : 0.16));
  
  // Text wrapping logic (same as preview component)
  const words = displayText.split(" ");
  const maxWordsPerLine = isVerticalVideo ? 4 : 6;
  const shouldSplitText = words.length > maxWordsPerLine;
  
  let line1 = displayText;
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

  const lines = shouldSplitText ? [line1, line2] : [displayText];
  const lineHeight = finalFontSize * 1.4; // Match preview line spacing
  const totalHeight = lines.length * lineHeight;
  let startY = baseY - totalHeight / 2 + lineHeight / 2;

  // Draw background with exact CSS values (matching working preview)
  if (style.backgroundColor && style.backgroundColor !== "transparent") {
    // Use exact CSS values for padding and border radius - scale proportionally
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
    ctx.fillStyle = style.backgroundColor;
    
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

  // Draw all text with exact same rendering as working preview
  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight;
    renderSimpleLine(ctx, line, x, lineY, finalFontSize, baseScale, style);
  });
}

// Helper function to render a simple line without highlighting (from working preview)
function renderSimpleLine(
  ctx: CanvasRenderingContext2D, 
  line: string, 
  x: number, 
  y: number, 
  fontSize: number, 
  baseScale: number = 1, 
  subtitleStyle: SubtitleStyle
) {
  // Draw shadow based on dropShadowIntensity (from working preview)
  if (subtitleStyle.dropShadowIntensity > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    const shadowOffset = subtitleStyle.dropShadowIntensity * 2;
    ctx.fillText(line.toUpperCase(), x + shadowOffset, y + shadowOffset);
    ctx.restore();
  }

  // Draw stroke/border - use exact border width from subtitleStyle
  if (subtitleStyle.borderWidth > 0) {
    ctx.strokeStyle = subtitleStyle.borderColor;
    // Use the border width as-is since we're scaling the font proportionally
    ctx.lineWidth = subtitleStyle.borderWidth;
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
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}