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
import { SubtitleStyle } from '@/components/ui/subtitle-styling';
import { processTranscriptChunks } from '@/lib/utils';

// Types
interface TranscriptChunk {
  text: string;
  timestamp: [number, number];
  disabled?: boolean;
}

interface UseVideoDownloadMediaBunnyProps {
  video: HTMLVideoElement | null;
  transcriptChunks: TranscriptChunk[];
  subtitleStyle: SubtitleStyle;
  mode: 'word' | 'phrase';
  format?: 'mp4' | 'webm';
  quality?: 'low' | 'medium' | 'high' | 'very_high';
  fps?: number;
}

// Quality mapping
const qualityMap = {
  low: QUALITY_LOW,
  medium: QUALITY_MEDIUM,
  high: QUALITY_HIGH,
  very_high: QUALITY_VERY_HIGH,
} as const;

export function useVideoDownloadMediaBunny({
  video,
  transcriptChunks,
  subtitleStyle,
  mode,
  format = 'mp4',
  quality = 'high',
  fps = 30
}: UseVideoDownloadMediaBunnyProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');

  const downloadVideo = useCallback(async () => {
    if (!video?.src || transcriptChunks.length === 0) {
      console.error('Missing video or transcript data');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatus('Initializing MediaBunny...');

    try {
      // Create canvas matching video dimensions
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to create canvas context');
      }

      console.log(`Canvas size: ${canvas.width}x${canvas.height}`);

      // Setup MediaBunny input
      setStatus('Reading original video...');
      const videoBlob = await fetch(video.src).then(r => r.blob());
      const input = new Input({
        source: new BlobSource(videoBlob),
        formats: ALL_FORMATS,
      });

      // Get video metadata
      const duration = await input.computeDuration();
      const originalVideoTrack = await input.getPrimaryVideoTrack();
      const originalAudioTrack = await input.getPrimaryAudioTrack();

      console.log(`Video duration: ${duration}s`);

      // Setup output
      const outputFormat = format === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat();
      const output = new Output({
        format: outputFormat,
        target: new BufferTarget(),
      });

      // Add video track
      const videoSource = new CanvasSource(canvas, {
        codec: format === 'webm' ? 'vp9' : 'avc',
        bitrate: qualityMap[quality],
      });
      output.addVideoTrack(videoSource, { frameRate: fps });

      // Handle audio if present
      let audioSource: AudioBufferSource | null = null;
      if (originalAudioTrack) {
        setStatus('Processing audio...');
        try {
          const arrayBuffer = await videoBlob.arrayBuffer();
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
          
          audioSource = new AudioBufferSource({
            codec: format === 'webm' ? 'opus' : 'aac',
            bitrate: qualityMap[quality],
          });
          output.addAudioTrack(audioSource);
          
          // Start output and add audio
          await output.start();
          await audioSource.add(audioBuffer);
          audioSource.close();
        } catch (error) {
          console.warn('Audio processing failed:', error);
          await output.start();
        }
      } else {
        await output.start();
      }

      // Setup video sample sink for precise frame extraction
      let videoSampleSink: VideoSampleSink | null = null;
      if (originalVideoTrack && await originalVideoTrack.canDecode()) {
        videoSampleSink = new VideoSampleSink(originalVideoTrack);
      }

      // Process chunks according to mode (word/phrase) and filter enabled ones
      const processedChunks = processTranscriptChunks({ chunks: transcriptChunks }, mode);
      const enabledChunks = processedChunks.filter(chunk => {
        if (mode === "phrase" && chunk.words) {
          // For phrase mode, check if any word in the phrase is disabled
          return !chunk.words.some(word => 
            transcriptChunks.find(originalChunk => 
              originalChunk.timestamp[0] === word.timestamp[0] && 
              originalChunk.timestamp[1] === word.timestamp[1]
            )?.disabled
          );
        } else {
          // For word mode, use the chunk's disabled status directly
          return !chunk.disabled;
        }
      });
      
      console.log(`Processing ${enabledChunks.length} ${mode} chunks (from ${transcriptChunks.length} original chunks)`);

      const totalFrames = Math.ceil(duration * fps);
      setStatus('Rendering video frames...');

      // Render each frame
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        const time = frameIndex / fps;
        
        // Update progress (convert to percentage 0-100)
        const progressPercent = (frameIndex / totalFrames) * 100;
        setProgress(progressPercent);
        setStatus(`Rendering: ${Math.round(time)}s / ${Math.round(duration)}s (${Math.round(progressPercent)}%)`);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw video frame
        if (videoSampleSink) {
          try {
            const sample = await videoSampleSink.getSample(time);
            if (sample) {
              sample.draw(ctx, 0, 0, canvas.width, canvas.height);
            }
          } catch (error) {
            console.warn(`Failed to get video sample at time ${time}:`, error);
          }
        }

        // Find and render current subtitle
        const currentChunk = enabledChunks.find(chunk => {
          const [start, end] = chunk.timestamp;
          return time >= start && time <= end;
        });

        if (currentChunk) {
          renderSubtitle(ctx, currentChunk, subtitleStyle, canvas, mode);
        }

        // Add frame to video source
        await videoSource.add(time, 1 / fps);
      }

      // Finalize export
      videoSource.close();
      setStatus('Finalizing video...');
      await output.finalize();

      // Download file
      const bufferTarget = output.target as BufferTarget;
      const buffer = bufferTarget.buffer;

      if (!buffer) {
        throw new Error('Failed to generate video buffer');
      }

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
      setProgress(100);
      console.log('Video export completed successfully');

    } catch (error) {
      console.error('MediaBunny video processing failed:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
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

// Subtitle rendering function
function renderSubtitle(
  ctx: CanvasRenderingContext2D,
  chunk: TranscriptChunk,
  style: SubtitleStyle,
  canvas: HTMLCanvasElement,
  mode: 'word' | 'phrase'
) {
  const displayText = chunk.text;
  const isVerticalVideo = canvas.height > canvas.width;

  // Calculate scale based on preview container size
  const previewContainer = document.querySelector('.video-container') as HTMLElement | null;
  const previewWidth = previewContainer?.clientWidth || 281;
  const previewHeight = previewContainer?.clientHeight || 500;
  
  const scaleX = canvas.width / previewWidth;
  const scaleY = canvas.height / previewHeight;
  const baseScale = Math.min(scaleX, scaleY);
  
  // Calculate font size to match preview proportions
  const finalFontSize = Math.round(style.fontSize * baseScale);
  
  console.log(`Preview: ${previewWidth}x${previewHeight}, Export: ${canvas.width}x${canvas.height}`);
  console.log(`Font: ${style.fontSize} -> ${finalFontSize} (scale: ${baseScale})`);
  console.log(`Style - Border: ${style.borderWidth}px ${style.borderColor}, Shadow: ${style.dropShadowIntensity}, BG: ${style.backgroundColor}`);

  // Handle font family - resolve CSS custom properties to actual font names
  let fontFamily = style.fontFamily;
  if (fontFamily.includes('var(')) {
    // Map CSS custom properties to actual font names that Canvas can use
    const fontMappings: { [key: string]: string } = {
      'var(--font-bangers)': 'Bangers',
      'var(--font-montserrat)': 'Montserrat',
      'var(--font-inter)': 'Inter',
    };
    
    // Find the CSS variable in the font family string
    for (const [cssVar, actualFont] of Object.entries(fontMappings)) {
      if (fontFamily.includes(cssVar)) {
        // Replace the CSS variable with the actual font name
        fontFamily = fontFamily.replace(cssVar, actualFont);
        break;
      }
    }
    
    // If no mapping found, extract fallback fonts
    if (fontFamily.includes('var(')) {
      const fallbackMatch = fontFamily.match(/,\s*(.+)$/);
      fontFamily = fallbackMatch ? fallbackMatch[1] : 'Arial, sans-serif';
    }
  }

  // Set font properties with font loading check
  const fontString = `${style.fontWeight} ${finalFontSize}px ${fontFamily}`;
  ctx.font = fontString;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  console.log(`Canvas font: "${fontString}" (resolved from "${style.fontFamily}")`);
  
  // Check if font is actually loaded by testing with document.fonts
  if ('fonts' in document) {
    const fontName = fontFamily.split(',')[0].trim().replace(/['"]/g, '');
    const isLoaded = document.fonts.check(`${style.fontWeight} ${finalFontSize}px "${fontName}"`);
    console.log(`Font "${fontName}" loaded:`, isLoaded);
    
    if (!isLoaded) {
      console.warn(`Font "${fontName}" not loaded, canvas will use fallback`);
    }
  }

  // Calculate positioning
  const x = canvas.width / 2;
  const baseY = canvas.height - (canvas.height * (isVerticalVideo ? 0.08 : 0.16));
  
  // Text wrapping logic
  const words = displayText.split(" ");
  const maxWordsPerLine = isVerticalVideo ? 4 : 6;
  const shouldSplitText = words.length > maxWordsPerLine;
  
  let lines = [displayText];
  if (shouldSplitText) {
    const midpoint = Math.ceil(words.length / 2);
    let splitPoint = midpoint;
    
    // Find natural break points
    for (let i = Math.max(2, midpoint - 2); i <= Math.min(words.length - 2, midpoint + 2); i++) {
      if (/[,;:.!?]$/.test(words[i])) {
        splitPoint = i + 1;
        break;
      }
    }
    
    lines = [
      words.slice(0, splitPoint).join(" "),
      words.slice(splitPoint).join(" ")
    ];
  }

  const lineHeight = finalFontSize * 1.4;
  const totalHeight = lines.length * lineHeight;
  const startY = baseY - totalHeight / 2 + lineHeight / 2;

  // Draw background if specified
  if (style.backgroundColor && style.backgroundColor !== "transparent") {
    const borderRadius = 8 * baseScale;
    const paddingX = 12 * baseScale;
    const paddingY = 8 * baseScale;
    
    // Measure maximum line width
    let maxWidth = 0;
    lines.forEach(line => {
      const metrics = ctx.measureText(line.toUpperCase());
      maxWidth = Math.max(maxWidth, metrics.width);
    });

    // Draw background perfectly centered with text
    const bgX = x - maxWidth / 2 - paddingX;
    const bgY = startY - lineHeight / 2 - paddingY;
    const bgWidth = maxWidth + paddingX * 2;
    const bgHeight = totalHeight + paddingY * 2;

    ctx.fillStyle = style.backgroundColor;
    ctx.beginPath();
    ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius);
    ctx.fill();
  }

  // Draw each line of text
  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight;
    renderTextLine(ctx, line, x, lineY, style, baseScale);
  });
}

// Text rendering helper
function renderTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: SubtitleStyle,
  baseScale: number = 1
) {
  const upperText = text.toUpperCase();

  // Draw shadow with proper scaling
  if (style.dropShadowIntensity > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    const shadowOffset = style.dropShadowIntensity * 2 * baseScale;
    ctx.fillText(upperText, x + shadowOffset, y + shadowOffset);
    ctx.restore();
  }

  // Draw border/stroke with scaling that matches preview appearance
  if (style.borderWidth > 0) {
    ctx.strokeStyle = style.borderColor;
    // Match the preview by using full baseScale with proper minimum values
    // Canvas strokeText and CSS WebkitTextStroke have similar visual weight when properly scaled
    const scaledBorderWidth = style.borderWidth * baseScale;
    // Ensure minimum visible thickness based on border setting
    const minimumBorder = style.borderWidth === 1 ? 2 : style.borderWidth === 2 ? 3 : scaledBorderWidth;
    const finalBorderWidth = Math.max(minimumBorder, scaledBorderWidth);
    ctx.lineWidth = finalBorderWidth;
    ctx.strokeText(upperText, x, y);
    console.log(`Rendering border: ${finalBorderWidth}px ${style.borderColor} for "${upperText}" (original: ${style.borderWidth}px, baseScale: ${baseScale})`);
  }

  // Draw main text with proper color handling
  let fillStyle: string | CanvasGradient = style.color;
  
  // Handle metallic gradient for silver colors
  if (style.color === "#CCCCCC" || style.color === "#C0C0C0") {
    const textWidth = ctx.measureText(upperText).width;
    const gradientHeight = 20 * baseScale; // Scale gradient height
    const gradient = ctx.createLinearGradient(
      x - textWidth / 2, y - gradientHeight,
      x + textWidth / 2, y + gradientHeight
    );
    gradient.addColorStop(0, "#FFFFFF");
    gradient.addColorStop(0.5, "#CCCCCC");
    gradient.addColorStop(1, "#999999");
    fillStyle = gradient;
  }

  ctx.fillStyle = fillStyle;
  ctx.fillText(upperText, x, y);
}