import { useState, useCallback } from 'react';

// Types from components
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

interface UseVideoDownloadCanvasProps {
  video: HTMLVideoElement | null;
  transcriptChunks: TranscriptChunk[];
  subtitleStyle: SubtitleStyle;
  mode: 'word' | 'phrase';
}

export function useVideoDownloadCanvas({
  video,
  transcriptChunks,
  subtitleStyle,
  mode
}: UseVideoDownloadCanvasProps) {
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
    setStatus('Setting up canvas recording...');

    try {
      // Create canvas for subtitle rendering
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      console.log(`Canvas size: ${canvas.width}x${canvas.height}`);

      // Filter enabled chunks
      const enabledChunks = transcriptChunks.filter(chunk => !chunk.disabled);
      console.log(`Processing ${enabledChunks.length} subtitle chunks`);

      // Create a processing video element
      const processingVideo = document.createElement('video');
      processingVideo.src = video.src;
      processingVideo.muted = true;
      processingVideo.preload = 'metadata';

      await new Promise((resolve) => {
        processingVideo.addEventListener('loadedmetadata', resolve, { once: true });
      });

      const duration = processingVideo.duration;
      console.log(`Video duration: ${duration}s`);

      // Setup MediaRecorder with optimized settings (from memories)
      setStatus('Initializing video recorder...');
      
      let mediaRecorder: MediaRecorder;
      let canvasStream: MediaStream;
      
      // Try different codec options for better compatibility
      const codecOptions = [
        'video/mp4;codecs=h264,aac',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm'
      ];
      
      let selectedCodec = '';
      for (const codec of codecOptions) {
        if (MediaRecorder.isTypeSupported(codec)) {
          selectedCodec = codec;
          break;
        }
      }
      
      if (!selectedCodec) {
        throw new Error('No supported video codec found');
      }
      
      console.log(`Using codec: ${selectedCodec}`);
      
      // Create canvas stream with stable 30 FPS (from memories)
      canvasStream = canvas.captureStream(30);
      
      // Extract and add audio from original video
      setStatus('Extracting audio from original video...');
      
      try {
        // Create audio context to capture audio from video element
        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(processingVideo);
        const destination = audioContext.createMediaStreamDestination();
        
        // Connect video audio to destination
        source.connect(destination);
        source.connect(audioContext.destination); // Also play through speakers
        
        // Add audio tracks to canvas stream
        destination.stream.getAudioTracks().forEach(track => {
          canvasStream.addTrack(track);
          console.log('Added audio track:', track.label);
        });
        
        console.log('Audio extraction successful');
      } catch (audioError) {
        console.warn('Audio extraction failed:', audioError);
        setStatus('Proceeding without audio...');
      }
      
      // Setup MediaRecorder with high quality settings
      const recordingOptions: MediaRecorderOptions = {
        mimeType: selectedCodec,
        videoBitsPerSecond: selectedCodec.includes('mp4') ? 12000000 : 
                           selectedCodec.includes('vp9') ? 10000000 : 8000000, // Much higher bitrates
        audioBitsPerSecond: 192000, // Higher audio quality
      };
      
      mediaRecorder = new MediaRecorder(canvasStream, recordingOptions);
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setStatus('Recording error occurred');
      };
      
      // Start recording
      mediaRecorder.start(500); // 500ms chunks for better quality
      setStatus('Recording video with subtitles...');
      
      // Play video and render subtitles in real-time
      processingVideo.currentTime = 0;
      processingVideo.play();
      
      // Stable render loop with better feedback and timing
      let frameCount = 0;
      const renderLoop = () => {
        if (processingVideo.ended || processingVideo.paused) {
          console.log('Video ended or paused, stopping render loop');
          return;
        }
        
        const currentTime = processingVideo.currentTime;
        const progressPercent = Math.min((currentTime / duration) * 100, 100);
        setProgress(progressPercent);
        
        // Update status more frequently for better feedback
        frameCount++;
        if (frameCount % 30 === 0) { // Update every second (30 frames)
          setStatus(`Recording: ${Math.round(currentTime)}s / ${Math.round(duration)}s (${Math.round(progressPercent)}%)`);
          console.log(`Recording progress: ${currentTime.toFixed(1)}s / ${duration.toFixed(1)}s`);
        }
        
        // Clear canvas and draw video frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Only draw if video is ready
        if (processingVideo.readyState >= 2) {
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
        }
        
        // Continue with stable 30 FPS timing
        setTimeout(renderLoop, 1000 / 30);
      };
      
      // Start render loop
      renderLoop();
      
      // Wait for video to finish with better handling
      await new Promise((resolve) => {
        const onEnded = () => {
          console.log('Video playback ended');
          setStatus('Video playback completed, finalizing...');
          resolve(void 0);
        };
        
        const onError = (e: Event) => {
          console.error('Video playback error:', e);
          resolve(void 0);
        };
        
        processingVideo.addEventListener('ended', onEnded, { once: true });
        processingVideo.addEventListener('error', onError, { once: true });
        
        // Safety timeout to prevent hanging
        setTimeout(() => {
          console.log('Safety timeout reached, finishing recording');
          processingVideo.removeEventListener('ended', onEnded);
          processingVideo.removeEventListener('error', onError);
          resolve(void 0);
        }, (duration + 5) * 1000); // Duration + 5 seconds buffer
      });
      
      // Stop recording with delay to ensure all frames are captured
      setStatus('Finalizing video...');
      setProgress(100);
      
      // Small delay to ensure last frames are captured
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      mediaRecorder.stop();
      console.log('MediaRecorder stopped');
      
      // Wait for final data
      await new Promise((resolve) => {
        mediaRecorder.onstop = () => {
          console.log('MediaRecorder stop event received');
          resolve(void 0);
        };
        
        // Safety timeout for MediaRecorder stop
        setTimeout(() => {
          console.log('MediaRecorder stop timeout');
          resolve(void 0);
        }, 5000);
      });
      
      // Create final video blob
      const videoBlob = new Blob(chunks, { 
        type: selectedCodec.split(';')[0] 
      });
      
      // Download the video
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      
      // Determine file extension
      const extension = selectedCodec.includes('mp4') ? 'mp4' : 'webm';
      a.download = `video_with_subtitles_${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      setStatus('Download complete!');
      console.log('Video download completed successfully');

    } catch (error) {
      console.error('Canvas video processing failed:', error);
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

// Reuse our proven canvas rendering logic from memories
function renderSubtitleOnCanvas(
  ctx: CanvasRenderingContext2D,
  chunk: TranscriptChunk,
  style: SubtitleStyle,
  canvas: HTMLCanvasElement,
  currentTime: number,
  mode: 'word' | 'phrase',
  allChunks: TranscriptChunk[]
) {
  const displayText = chunk.text;

  // Calculate font size to exactly match preview (from memories)
  const isVerticalVideo = canvas.height > canvas.width;
  
  // Use the exact same scaling logic as the preview component
  // Base font size should be much larger to match preview
  let baseFontSize: number;
  
  if (isVerticalVideo) {
    baseFontSize = canvas.width * 0.08; // 8% for vertical videos
  } else {
    baseFontSize = canvas.height * 0.065; // 6.5% for landscape videos  
  }
  
  // Apply the style fontSize with aggressive scaling to match preview
  const videoScale = Math.min(canvas.width / 800, canvas.height / 600);
  const scaledStyleSize = style.fontSize * Math.max(2.5, videoScale * 4); // More aggressive scaling
  
  // Use the larger of the two for maximum readability
  const finalFontSize = Math.max(baseFontSize, scaledStyleSize);
  
  console.log(`Font sizing - Canvas: ${canvas.width}x${canvas.height}, Base: ${baseFontSize.toFixed(1)}, Scaled: ${scaledStyleSize.toFixed(1)}, Final: ${finalFontSize.toFixed(1)}`);

  // Set font properties
  ctx.font = `${style.fontWeight} ${finalFontSize}px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Calculate positioning (from memories)
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
    
    // Render background if specified (with proper scaling)
    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
      const textMetrics = ctx.measureText(line);
      const padding = Math.max(12, finalFontSize * 0.3); // Scale padding with font size
      const verticalPadding = Math.max(8, finalFontSize * 0.2);
      
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(
        canvas.width / 2 - textMetrics.width / 2 - padding,
        y - finalFontSize / 2 - verticalPadding,
        textMetrics.width + padding * 2,
        finalFontSize + verticalPadding * 2
      );
    }

    // Render border/outline (scale with font size)
    if (style.borderWidth > 0 && style.borderColor) {
      ctx.strokeStyle = style.borderColor;
      ctx.lineWidth = Math.max(style.borderWidth, finalFontSize * 0.05); // Scale border with font
      ctx.strokeText(line, canvas.width / 2, y);
    }

    // Render shadow based on dropShadowIntensity (scale with font size)
    if (style.dropShadowIntensity > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      const shadowOffset = Math.max(style.dropShadowIntensity * 2, finalFontSize * 0.03);
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
