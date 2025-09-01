import { useState, useCallback } from 'react';
import { 
  Input, 
  Output, 
  CanvasSource, 
  AudioBufferSource,
  Mp4OutputFormat,
  BufferTarget,
  BlobSource,
  ALL_FORMATS,
  QUALITY_HIGH,
  QUALITY_MEDIUM
} from 'mediabunny';
// Types imported from components
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

interface UseVideoDownloadMediaBunnyProps {
  video: HTMLVideoElement | null;
  transcriptChunks: TranscriptChunk[];
  subtitleStyle: SubtitleStyle;
  mode: 'word' | 'phrase';
}

export function useVideoDownloadMediaBunny({
  video,
  transcriptChunks,
  subtitleStyle,
  mode
}: UseVideoDownloadMediaBunnyProps) {
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
      const ctx = canvas.getContext('2d')!;
      
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      console.log(`Canvas size: ${canvas.width}x${canvas.height}`);

      // Setup MediaBunny input for original video
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
      if (originalVideoTrack) {
        console.log(`Original resolution: ${originalVideoTrack.displayWidth}x${originalVideoTrack.displayHeight}`);
      }

      // Setup MediaBunny output
      setStatus('Setting up output...');
      const output = new Output({
        format: new Mp4OutputFormat(),
        target: new BufferTarget(),
      });

      // Create canvas source for video with subtitles
      const videoSource = new CanvasSource(canvas, {
        codec: 'avc', // H.264 codec
        bitrate: QUALITY_HIGH,
      });

      output.addVideoTrack(videoSource);

      // Add audio track if present
      if (originalAudioTrack) {
        // For now, we'll need to implement audio extraction
        // This is a simplified version - we may need to decode and re-encode audio
        setStatus('Processing audio...');
        
        const audioSource = new AudioBufferSource({
          codec: 'aac',
          bitrate: QUALITY_MEDIUM,
        });
        
        output.addAudioTrack(audioSource);
      }

      // Start output
      await output.start();
      setStatus('Rendering video with subtitles...');

      // Filter enabled chunks
      const enabledChunks = transcriptChunks.filter(chunk => !chunk.disabled);
      console.log(`Processing ${enabledChunks.length} subtitle chunks`);

      // Create a temporary video element for frame-by-frame processing
      const processingVideo = document.createElement('video');
      processingVideo.src = video.src;
      processingVideo.muted = true;
      processingVideo.preload = 'metadata';

      await new Promise((resolve) => {
        processingVideo.addEventListener('loadedmetadata', resolve, { once: true });
      });

      // Set up real-time rendering with video playback
      setStatus('Starting video playback and recording...');
      
      // Play the video and capture canvas in real-time
      processingVideo.currentTime = 0;
      processingVideo.play();
      
      let lastRenderTime = 0;
      const targetFPS = 30;
      const frameInterval = 1000 / targetFPS;
      
      const renderLoop = () => {
        const now = performance.now();
        
        if (now - lastRenderTime >= frameInterval) {
          const currentTime = processingVideo.currentTime;
          const progressPercent = (currentTime / duration) * 100;
          setProgress(progressPercent);
          setStatus(`Recording: ${Math.round(currentTime)}s / ${Math.round(duration)}s (${Math.round(progressPercent)}%)`);
          
          // Clear canvas and draw current video frame
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(processingVideo, 0, 0, canvas.width, canvas.height);
          
          // Find and render current subtitle
          const currentChunk = enabledChunks.find(chunk => {
            const start = chunk.timestamp[0];
            const end = chunk.timestamp[1];
            return currentTime >= start && currentTime <= end;
          });

          if (currentChunk) {
            renderSubtitleOnCanvas(ctx, currentChunk, subtitleStyle, canvas, currentTime, mode, enabledChunks);
          }
          
          lastRenderTime = now;
        }
        
        // Continue until video ends
        if (!processingVideo.ended && !processingVideo.paused) {
          requestAnimationFrame(renderLoop);
        }
      };
      
      // Start the render loop
      requestAnimationFrame(renderLoop);
      
      // Wait for video to finish playing
      await new Promise((resolve) => {
        processingVideo.addEventListener('ended', resolve, { once: true });
      });

      // Finalize output
      setStatus('Finalizing video...');
      await output.finalize();

      // Get the final video buffer
      const bufferTarget = output.target as BufferTarget;
      const buffer = bufferTarget.buffer;
      
      if (!buffer) {
        throw new Error('Failed to generate video buffer');
      }
      
      // Create download
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `video_with_subtitles_${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      setStatus('Download complete!');
      console.log('Video download completed successfully');

    } catch (error) {
      console.error('MediaBunny video processing failed:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [video, transcriptChunks, subtitleStyle, mode]);

  return {
    downloadVideo,
    isProcessing,
    progress,
    status
  };
}

// Reuse our existing canvas rendering logic that works perfectly in preview
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
    // For phrase mode, find current word for highlighting
    displayText = chunk.text;
  }

  // Calculate font size (use our proven scaling from memories)
  const isVerticalVideo = canvas.height > canvas.width;
  let baseFontSize: number;
  
  if (isVerticalVideo) {
    baseFontSize = canvas.width * 0.12; // 12% of width for vertical
  } else {
    baseFontSize = canvas.height * 0.1; // 10% of height for landscape
  }
  
  // Scale with style fontSize
  const baseScale = Math.min(canvas.width / 800, canvas.height / 600);
  const scaledFontSize = style.fontSize * Math.max(2, baseScale * 3);
  const finalFontSize = Math.max(scaledFontSize, baseFontSize);

  // Set font properties
  ctx.font = `${style.fontWeight} ${finalFontSize}px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Calculate positioning
  const bottomPercent = isVerticalVideo ? 0.08 : 0.16;
  const maxWidth = canvas.width * (isVerticalVideo ? 0.85 : 0.9);
  
  // Split text into lines if needed
  const lines = wrapText(ctx, displayText, maxWidth);
  const lineHeight = finalFontSize * 1.2;
  const totalTextHeight = lines.length * lineHeight;
  
  const startY = canvas.height - (canvas.height * bottomPercent) - (totalTextHeight / 2);

  // Render each line
  lines.forEach((line, index) => {
    const y = startY + (index * lineHeight);
    
    // Render background if specified
    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
      const textMetrics = ctx.measureText(line);
      const padding = 12; // Fixed padding like preview
      
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(
        canvas.width / 2 - textMetrics.width / 2 - padding,
        y - finalFontSize / 2 - 8,
        textMetrics.width + padding * 2,
        finalFontSize + 16
      );
    }

    // Render border/outline
    if (style.borderWidth > 0 && style.borderColor) {
      ctx.strokeStyle = style.borderColor;
      ctx.lineWidth = style.borderWidth;
      ctx.strokeText(line, canvas.width / 2, y);
    }

    // Render shadow based on dropShadowIntensity
    if (style.dropShadowIntensity > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      const shadowOffset = style.dropShadowIntensity * 2;
      ctx.fillText(line, canvas.width / 2 + shadowOffset, y + shadowOffset);
      ctx.restore();
    }

    // Render main text
    ctx.fillStyle = style.color;
    ctx.fillText(line, canvas.width / 2, y);
  });
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
