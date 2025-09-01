import { SubtitleStyle } from "@/components/ui/subtitle-styling";
import { TranscriptionStatus } from "@/hooks/useTranscription";
import { processTranscriptChunks } from "@/lib/utils";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

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
  videoFit: "cover" | "contain" | "fill";
}

export function useVideoDownloadFFmpeg({
  videoRef,
  result,
  subtitleStyle,
  setStatus,
  setProgress,
  mode,
  ratio,
  videoFit,
}: UseVideoDownloadProps) {
  const handleDownloadVideo = async () => {
    if (!videoRef.current || !result) {
      console.error("No video or transcription result available");
      return;
    }

    const video = videoRef.current;
    const videoSrc = video.src;

    if (!videoSrc) {
      console.error("No video source available");
      return;
    }

    setStatus("processing");
    setProgress(0);

    try {
      // Initialize FFmpeg
      const ffmpeg = new FFmpeg();
      
      // Load FFmpeg with progress tracking
      await ffmpeg.load({
        coreURL: await toBlobURL(`https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setProgress(10);

      // Process transcript chunks and filter out disabled ones
      console.log('Original result chunks:', result.chunks.length);
      console.log('Mode:', mode);
      
      const processedChunks = processTranscriptChunks({ chunks: result.chunks }, mode);
      const enabledChunks = processedChunks.filter(chunk => !chunk.disabled);
      
      console.log('Processed chunks:', processedChunks.length);
      console.log('Enabled chunks:', enabledChunks.length);
      
      // Optimize for long videos - use phrase mode or reduce chunk count
      let finalChunks = enabledChunks;
      
      if (enabledChunks.length > 100) {
        console.log(`Video has ${enabledChunks.length} subtitle chunks, applying optimizations...`);
        
        if (mode === "word") {
          // For word mode with many chunks, group them into phrases for better performance
          console.log('Grouping words into phrases for performance');
          finalChunks = groupWordsIntoPhrasesForPerformance(enabledChunks, 3); // Group every 3 words
        } else {
          // For phrase mode, limit to reasonable number
          if (enabledChunks.length > 150) {
            console.warn(`Limiting phrases from ${enabledChunks.length} to 150 for performance`);
            finalChunks = enabledChunks.slice(0, 150);
          }
        }
        
        console.log(`Optimized from ${enabledChunks.length} to ${finalChunks.length} chunks`);
      }
      
      if (finalChunks.length === 0) {
        console.error('No enabled chunks found!');
        console.log('All processed chunks:', processedChunks);
        throw new Error('No subtitle chunks available for processing');
      }
      
      console.log('Sample chunk:', finalChunks[0]);

      // Write video file to FFmpeg filesystem
      const videoData = await fetchFile(videoSrc);
      await ffmpeg.writeFile('input.mp4', videoData);
      
      // Download a real font file for FFmpeg
      console.log('Downloading font file for subtitles...');
      try {
        // Use a simple, reliable font from Google Fonts
        const fontUrl = 'https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVc.ttf';
        const fontData = await fetchFile(fontUrl);
        await ffmpeg.writeFile('font.ttf', fontData);
        console.log('Font file downloaded successfully');
      } catch (fontError) {
        console.error('Failed to download font:', fontError);
        throw new Error('Could not load font file for subtitles');
      }

      setProgress(30);

      setProgress(40);

      // Set up progress monitoring
      ffmpeg.on('progress', ({ progress }) => {
        setProgress(40 + (progress * 50)); // Map FFmpeg progress to 40-90%
      });

      // Set up error logging
      ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg log:', message);
      });

      // If video is long, prefer server-side Remotion renderer for reliability
      const videoDurationSec = Number.isFinite(video.duration) ? video.duration : 0;

      if (videoDurationSec > 60) {
        try {
          setProgress(12);
          console.log('Long video detected, attempting server-side render via /api/render-video');
          const dataUrl = await ensureDataUrlFromSrc(videoSrc);
          setProgress(20);
          const response = await fetch('/api/render-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoSrc: dataUrl,
              transcriptData: { text: result.text, chunks: result.chunks },
              subtitleStyle,
              mode,
              ratio,
              zoomPortrait: ratio === '9:16' && videoFit === 'cover',
              quality: 'medium',
            }),
          });
          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err?.error || 'Server render failed');
          }
          const json = await response.json();
          if (!json?.outputPath) throw new Error('Missing outputPath from server');

          setProgress(90);
          const link = document.createElement('a');
          link.href = json.outputPath;
          link.download = `video_with_subtitles_${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setProgress(100);
          setStatus('ready');

          // Cleanup FFmpeg instance early since we won't need it
          try { await ffmpeg.deleteFile('input.mp4'); } catch {}
          try { await ffmpeg.deleteFile('font.ttf'); } catch {}
          ffmpeg.terminate();
          return;
        } catch (srvErr) {
          console.warn('Server-side render failed, falling back to in-browser processing', srvErr);
          // Continue with in-browser path below
        }
      }

      // Build filters and encode directly (avoid in-memory copy to reduce memory pressure)
      

      // Additional guard for long videos: cap subtitle chunks more aggressively
      if (videoDurationSec > 60 && finalChunks.length > 60) {
        console.warn(`Long video detected (~${Math.round(videoDurationSec)}s). Limiting subtitle chunks to 60 for stability (was ${finalChunks.length}).`);
        finalChunks = finalChunks.slice(0, 60);
      }

      // Generate subtitle drawtext filters
      const drawtextFilters = createDrawtextFilters(finalChunks, subtitleStyle, ratio, videoFit);
      console.log('Generated drawtext filters:', drawtextFilters.length);
      if (drawtextFilters.length > 0) {
        console.log('First filter example:', drawtextFilters[0]);
      }

      if (drawtextFilters.length > 50) {
        console.warn(`Many subtitle filters (${drawtextFilters.length}), this may impact performance`);
      }

      // Add video scaling based on ratio and fit mode
      const videoFilters: string[] = [];
      if (ratio === "9:16") {
        const targetWidth = 720;
        const targetHeight = 1280;
        if (videoFit === "contain") {
          videoFilters.push(`scale=w=${targetWidth}:h=${targetHeight}:force_original_aspect_ratio=decrease`);
          videoFilters.push(`pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`);
        } else if (videoFit === "cover") {
          videoFilters.push(`scale=w=${targetWidth}:h=${targetHeight}:force_original_aspect_ratio=increase`);
          videoFilters.push(`crop=${targetWidth}:${targetHeight}`);
        } else if (videoFit === "fill") {
          videoFilters.push(`scale=${targetWidth}:${targetHeight}`);
        }
      } else {
        const targetWidth = 1280;
        const targetHeight = 720;
        if (videoFit === "contain") {
          videoFilters.push(`scale=w=${targetWidth}:h=${targetHeight}:force_original_aspect_ratio=decrease`);
          videoFilters.push(`pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`);
        } else if (videoFit === "cover") {
          videoFilters.push(`scale=w=${targetWidth}:h=${targetHeight}:force_original_aspect_ratio=increase`);
          videoFilters.push(`crop=${targetWidth}:${targetHeight}`);
        } else if (videoFit === "fill") {
          videoFilters.push(`scale=${targetWidth}:${targetHeight}`);
        }
      }

      const allFilters = [...videoFilters, ...drawtextFilters];
      const filterGraph = allFilters.length > 0 ? allFilters.join(',') : 'scale=iw:ih';

      const baseEncodeArgs = [
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
      ];

      try {
        const ffmpegCommand = [
          '-i', 'input.mp4',
          '-vf', filterGraph,
          ...baseEncodeArgs,
          '-y',
          'output.mp4',
        ];
        console.log('FFmpeg command:', ffmpegCommand.join(' '));
        console.log('Filter count:', allFilters.length);

        await ffmpeg.exec(ffmpegCommand);

        // Verify output exists
        // Sometimes the virtual FS isn't immediately readable; retry briefly
        let outputData = await ffmpeg.readFile('output.mp4');
        if (!outputData || outputData.length === 0) {
          for (let i = 0; i < 5; i++) {
            await new Promise((r) => setTimeout(r, 300));
            try {
              outputData = await ffmpeg.readFile('output.mp4');
              if (outputData && outputData.length > 0) break;
            } catch {}
          }
          if (!outputData || outputData.length === 0) {
            throw new Error('Processing created empty output');
          }
        }
        console.log('Processing with filters successful, output size:', outputData.length);
      } catch (filterError) {
        console.error('Processing with filters failed:', filterError);

        // Progressive fallbacks
        let fallbackWorked = false;

        // 1) Reduced subtitles
        if (drawtextFilters.length > 20 && !fallbackWorked) {
          try {
            console.log('Fallback 1: reduced subtitles (first 20)');
            const reducedChunks = finalChunks.slice(0, 20);
            const reducedFilters = createDrawtextFilters(reducedChunks, subtitleStyle, ratio, videoFit);
            const reducedGraph = [...videoFilters, ...reducedFilters].join(',') || 'scale=iw:ih';
            await ffmpeg.exec([
              '-i', 'input.mp4',
              '-vf', reducedGraph,
              ...baseEncodeArgs,
              '-y',
              'output.mp4',
            ]);
            fallbackWorked = true;
          } catch {
            console.log('Fallback 1 failed');
          }
        }

        // 2) Simple subtitles
        if (!fallbackWorked) {
          try {
            console.log('Fallback 2: simple subtitles');
            const simpleFilters = createSimpleDrawtextFilters(finalChunks, ratio);
            const simpleGraph = [...videoFilters, ...simpleFilters].join(',') || 'scale=iw:ih';
            await ffmpeg.exec([
              '-i', 'input.mp4',
              '-vf', simpleGraph,
              ...baseEncodeArgs,
              '-y',
              'output.mp4',
            ]);
            fallbackWorked = true;
          } catch {
            console.log('Fallback 2 failed');
          }
        }

        // 3) Video only
        if (!fallbackWorked) {
          try {
            console.log('Fallback 3: video scaling only (no subtitles)');
            const scalingGraph = videoFilters.join(',') || 'scale=iw:ih';
            await ffmpeg.exec([
              '-i', 'input.mp4',
              '-vf', scalingGraph,
              ...baseEncodeArgs,
              '-y',
              'output.mp4',
            ]);
            fallbackWorked = true;
          } catch {
            console.log('Fallback 3 failed');
          }
        }

        // 4) Final fallback: remux only
        if (!fallbackWorked) {
          console.log('Final fallback: remux/copy without processing');
          await ffmpeg.exec(['-i', 'input.mp4', '-c', 'copy', '-y', 'output.mp4']);
        }
      }

      setProgress(95);

      // Check if output file exists and read it
      let outputBlob: Blob;
      try {
        const outputData = await ffmpeg.readFile('output.mp4');
        console.log('Output file size:', outputData.length, 'bytes');
        
        if (outputData.length === 0) {
          throw new Error('Output file is empty');
        }
        
        outputBlob = new Blob([outputData], { type: 'video/mp4' });
        console.log('Created blob size:', outputBlob.size, 'bytes');
      } catch (readError) {
        console.error('Failed to read output file:', readError);
        
        // Try to fallback to just copying the input file
        console.log('Attempting fallback: copying input file without subtitles');
        const inputData = await ffmpeg.readFile('input.mp4');
        outputBlob = new Blob([inputData], { type: 'video/mp4' });
        console.log('Fallback blob size:', outputBlob.size, 'bytes');
      }

      // Create download link
      const url = URL.createObjectURL(outputBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `video_with_subtitles_${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress(100);
      setStatus("ready");

      // Cleanup FFmpeg virtual FS to free memory before terminating
      try {
        await ffmpeg.deleteFile('output.mp4');
      } catch {}
      try {
        await ffmpeg.deleteFile('input.mp4');
      } catch {}
      try {
        await ffmpeg.deleteFile('font.ttf');
      } catch {}

      ffmpeg.terminate();

    } catch (error) {
      console.error("Error processing video with FFmpeg:", error);

      // Try browser Canvas + MediaRecorder fallback for longer videos or when FFmpeg fails
      try {
        console.log('Attempting Canvas + MediaRecorder fallback...');
        setStatus('processing');
        setProgress(10);

        const outputBlob = await renderWithCanvasRecorder({
          videoElement: videoRef.current!,
          videoSrc,
          chunks: result.chunks,
          subtitleStyle,
          ratio,
          videoFit,
          setProgress,
        });

        const url = URL.createObjectURL(outputBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `video_with_subtitles_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setProgress(100);
        setStatus('ready');
        return;
      } catch (fallbackError) {
        console.error('Canvas fallback also failed:', fallbackError);
        setStatus("idle");
        setProgress(0);
      }
    }
  };

  return { handleDownloadVideo };
}

interface CanvasFallbackParams {
  videoElement: HTMLVideoElement;
  videoSrc: string;
  chunks: Array<{ text: string; timestamp: [number, number]; disabled?: boolean }>;
  subtitleStyle: SubtitleStyle;
  ratio: "16:9" | "9:16";
  videoFit: "cover" | "contain" | "fill";
  setProgress: (p: number) => void;
}

async function renderWithCanvasRecorder({
  videoElement,
  videoSrc,
  chunks,
  subtitleStyle,
  ratio,
  videoFit,
  setProgress,
}: CanvasFallbackParams): Promise<Blob> {
  const isVertical = ratio === '9:16';
  const targetWidth = isVertical ? 720 : 1280;
  const targetHeight = isVertical ? 1280 : 720;

  const video = document.createElement('video');
  video.muted = true;
  video.crossOrigin = 'anonymous';
  video.src = videoSrc;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video for canvas fallback'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const fps = 30;
  const canvasStream = (canvas as HTMLCanvasElement).captureStream(fps);

  // Add audio from source video when possible
  const audio = document.createElement('audio');
  audio.src = videoSrc;
  audio.crossOrigin = 'anonymous';
  audio.muted = false;
  await new Promise<void>((resolve) => { audio.onloadedmetadata = () => resolve(); });
  const audioCtx = new AudioContext();
  const sourceNode = audioCtx.createMediaElementSource(audio);
  const dest = audioCtx.createMediaStreamDestination();
  sourceNode.connect(dest);
  sourceNode.connect(audioCtx.destination);
  const mixedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const recorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 });
  const recorded: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recorded.push(e.data); };

  // Preprocess chunks: filter disabled, merge long lists
  const activeChunks = chunks.filter(c => !c.disabled);

  function drawSubtitles(currentTime: number) {
    // Find active chunk at this time
    const current = activeChunks.find(c => currentTime >= c.timestamp[0] && currentTime <= c.timestamp[1]);
    if (!current) return;

    // Text style
    const fontSize = Math.max(subtitleStyle.fontSize * 1.2, 28);
    const y = isVertical ? targetHeight - targetHeight * 0.15 : targetHeight - targetHeight * 0.12;
    const text = (current.text || '').toUpperCase();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const weight = ['700','800','900','bold'].includes(String(subtitleStyle.fontWeight)) ? 'bold' : 'normal';
    ctx.font = `${weight} ${fontSize}px sans-serif`;

    // Optional background box
    const paddingX = Math.max(12, fontSize * 0.3);
    const paddingY = Math.max(8, fontSize * 0.2);
    const textWidth = ctx.measureText(text).width;
    if (subtitleStyle.backgroundColor && subtitleStyle.backgroundColor !== 'transparent') {
      ctx.fillStyle = subtitleStyle.backgroundColor;
      const boxX = targetWidth / 2 - textWidth / 2 - paddingX;
      const boxY = y - fontSize / 2 - paddingY / 2;
      const boxW = textWidth + paddingX * 2;
      const boxH = fontSize + paddingY;
      ctx.fillRect(boxX, boxY, boxW, boxH);
    }

    // Shadow
    if (subtitleStyle.dropShadowIntensity > 0) {
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Border via stroke
    if (subtitleStyle.borderWidth > 0) {
      ctx.lineWidth = Math.max(1, subtitleStyle.borderWidth);
      ctx.strokeStyle = subtitleStyle.borderColor;
      ctx.strokeText(text, targetWidth / 2, y);
    }

    ctx.fillStyle = subtitleStyle.color;
    ctx.fillText(text, targetWidth / 2, y);
    ctx.restore();
  }

  function drawFrame() {
    // Center-crop/scale based on fit
    const vidW = video.videoWidth;
    const vidH = video.videoHeight;
    const srcAspect = vidW / vidH;
    const dstAspect = targetWidth / targetHeight;

    let sx = 0, sy = 0, sw = vidW, sh = vidH;
    if (videoFit === 'cover') {
      if (srcAspect > dstAspect) {
        // crop width
        sh = vidH; sw = sh * dstAspect; sx = (vidW - sw) / 2; sy = 0;
      } else {
        sw = vidW; sh = sw / dstAspect; sy = (vidH - sh) / 2; sx = 0;
      }
    } else if (videoFit === 'contain') {
      // draw with letterbox
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      const scale = Math.min(targetWidth / vidW, targetHeight / vidH);
      const dw = vidW * scale; const dh = vidH * scale;
      const dx = (targetWidth - dw) / 2; const dy = (targetHeight - dh) / 2;
      ctx.drawImage(video, 0, 0, vidW, vidH, dx, dy, dw, dh);
      drawSubtitles(video.currentTime);
      return;
    }

    // cover or fill
    if (videoFit === 'fill') {
      sx = 0; sy = 0; sw = vidW; sh = vidH;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    }

    drawSubtitles(video.currentTime);
  }

  const chunksOut: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksOut.push(e.data); };

  recorder.start(250);
  await Promise.all([video.play(), audio.play().catch(() => undefined)]);
  setProgress(20);

  await new Promise<void>((resolve) => {
    const handle = () => {
      drawFrame();
      if (!video.paused && !video.ended) {
        requestAnimationFrame(handle);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(handle);
  });

  recorder.stop();
  await new Promise((r) => setTimeout(r, 50));
  setProgress(95);
  return new Blob(chunksOut, { type: 'video/webm' });
}

async function ensureDataUrlFromSrc(src: string): Promise<string> {
  if (src.startsWith('data:video/')) return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error('Failed to fetch video for server render');
  const blob = await res.blob();
  const reader = new FileReader();
  const p = new Promise<string>((resolve, reject) => {
    reader.onerror = () => reject(new Error('Failed converting video to data URL'));
    reader.onloadend = () => resolve(String(reader.result));
  });
  reader.readAsDataURL(blob);
  return p;
}

// Generate SRT subtitle file content
function generateSRT(chunks: any[], subtitleStyle: SubtitleStyle): string {
  let srtContent = '';
  
  if (!chunks || chunks.length === 0) {
    console.warn('No chunks provided for SRT generation');
    return '';
  }
  
  chunks.forEach((chunk, index) => {
    if (!chunk.timestamp || chunk.timestamp.length < 2) {
      console.warn('Invalid timestamp for chunk:', chunk);
      return;
    }
    
    const startTime = formatSRTTime(chunk.timestamp[0]);
    const endTime = formatSRTTime(chunk.timestamp[1]);
    
    // Format text based on style
    let text = chunk.text ? chunk.text.trim() : '';
    
    if (!text) {
      console.warn('Empty text for chunk:', chunk);
      return;
    }
    
    // Apply text transformations based on style
    if (subtitleStyle.fontWeight === 'bold' || subtitleStyle.fontWeight === '800' || subtitleStyle.fontWeight === '900') {
      text = `<b>${text}</b>`;
    }
    
    // Word highlighting removed - not supported by FFmpeg drawtext

    srtContent += `${index + 1}\n`;
    srtContent += `${startTime} --> ${endTime}\n`;
    srtContent += `${text}\n\n`;
  });

  if (!srtContent.trim()) {
    console.error('Generated SRT content is empty!');
  }

  return srtContent;
}

// Format time for SRT format (HH:MM:SS,mmm)
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// Add word-level highlighting to text
// addWordHighlighting function removed - not supported by FFmpeg drawtext

// Create drawtext filters for each subtitle chunk
function createDrawtextFilters(chunks: any[], subtitleStyle: SubtitleStyle, ratio: "16:9" | "9:16", videoFit: "cover" | "contain" | "fill"): string[] {
  const isVertical = ratio === "9:16";
  const filters: string[] = [];
  
  // Optimize for performance - limit total filters
  const maxFilters = 60; // Lowered for stability on longer videos
  const chunksToProcess = chunks.slice(0, maxFilters);
  
  if (chunks.length > maxFilters) {
    console.log(`Limiting subtitle filters from ${chunks.length} to ${maxFilters} for performance`);
  }
  
  // Scale font size appropriately for video
  const fontSize = Math.max(subtitleStyle.fontSize * 1.5, 32); // Scale up for video visibility
  
  // Convert hex color to FFmpeg format (remove #)
  const fontColor = subtitleStyle.color.replace('#', '');
  const borderColor = subtitleStyle.borderColor.replace('#', '');
  
  chunksToProcess.forEach((chunk, index) => {
    const startTime = chunk.timestamp[0];
    const endTime = chunk.timestamp[1];
    // Clean text - remove extra spaces and escape properly for FFmpeg
    const text = chunk.text.trim()
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/'/g, "\\'")     // Escape single quotes
      .replace(/"/g, '\\"')    // Escape double quotes
      .replace(/:/g, '\\:')     // Escape colons (FFmpeg parameter separator)
      .replace(/=/g, '\\=');    // Escape equals signs
    
    // Positioning based on aspect ratio
    const yPosition = isVertical ? 'h-h*0.15' : 'h-h*0.12'; // Percentage-based positioning
    
    // Create drawtext filter with full styling
    let filter = `drawtext=fontfile=font.ttf:text='${text.toUpperCase()}'`; // Uppercase like preview
    filter += `:fontsize=${fontSize}`;
    filter += `:fontcolor=${fontColor}`; // Use user's color choice
    
    // Add border/outline - combine bold effect with user border
    let borderWidth = 0;
    let finalBorderColor = borderColor;
    
    // Make font bold/heavy to match preview weight
    if (subtitleStyle.fontWeight === '700' || subtitleStyle.fontWeight === '800' || subtitleStyle.fontWeight === '900' || subtitleStyle.fontWeight === 'bold') {
      borderWidth = Math.max(borderWidth, 1); // At least 1px for bold effect
      finalBorderColor = fontColor; // Use font color for bold effect
    }
    
    // Add user-specified border (overrides bold border)
    if (subtitleStyle.borderWidth > 0) {
      borderWidth = subtitleStyle.borderWidth * 2; // Scale border for visibility
      finalBorderColor = borderColor; // Use user's border color
    }
    
    // Apply final border settings
    if (borderWidth > 0) {
      filter += `:borderw=${borderWidth}:bordercolor=${finalBorderColor}`;
    }
    
    // Add shadow to match preview (2px 2px 3px with 0.6 opacity)
    if (subtitleStyle.dropShadowIntensity > 0) {
      filter += `:shadowx=2:shadowy=2`; // Match CSS: 2px 2px
      filter += `:shadowcolor=000000@0.6`; // Match CSS: rgba(0,0,0,0.6)
    }
    
    // Add rectangular background (closest we can get to rounded)
    if (subtitleStyle.backgroundColor && subtitleStyle.backgroundColor !== 'transparent') {
      const bgColor = subtitleStyle.backgroundColor.replace('#', '');
      const paddingH = Math.max(12, fontSize * 0.3); // px-3 = 12px
      const paddingV = Math.max(8, fontSize * 0.2);  // py-2 = 8px
      
      filter += `:box=1:boxcolor=${bgColor}`; // Solid background
      filter += `:boxborderw=${paddingH}`; // Horizontal padding
      
      // FFmpeg limitation: No border-radius support in drawtext
      // Background will be rectangular instead of rounded (0.375rem/6px radius)
    }
    
    // Positioning and timing
    filter += `:x=(w-text_w)/2`; // Center horizontally
    filter += `:y=${yPosition}`; // Position from bottom
    filter += `:enable='between(t,${startTime},${endTime})'`; // Show during timestamp
    
    // Debug: Log problematic filters
    if (index < 3) {
      console.log(`Filter ${index}:`, filter);
    }
    
    // Validate filter length (FFmpeg has limits)
    if (filter.length > 1000) {
      console.warn(`Filter ${index} is very long (${filter.length} chars), might cause issues`);
    }
    
    filters.push(filter);
  });
  
  return filters;
}

// Create simple drawtext filters with minimal styling (fallback)
function createSimpleDrawtextFilters(chunks: any[], ratio: "16:9" | "9:16"): string[] {
  const isVertical = ratio === "9:16";
  const filters: string[] = [];
  const maxFilters = 40; // Even more conservative limit
  
  const chunksToProcess = chunks.slice(0, maxFilters);
  console.log(`Creating ${chunksToProcess.length} simple filters (fallback mode)`);
  
  chunksToProcess.forEach((chunk, index) => {
    const startTime = chunk.timestamp[0];
    const endTime = chunk.timestamp[1];
    
    // Very simple text cleaning
    const text = chunk.text.trim().replace(/[':"=\\]/g, ' ');
    
    // Basic filter with minimal styling
    const yPosition = isVertical ? 'h-h*0.15' : 'h-h*0.12';
    const filter = `drawtext=text='${text}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=${yPosition}:enable='between(t,${startTime},${endTime})'`;
    
    filters.push(filter);
  });
  
  return filters;
}

// Helper function to group words into phrases for better performance
function groupWordsIntoPhrasesForPerformance(chunks: any[], wordsPerPhrase: number): any[] {
  const groupedChunks: any[] = [];
  
  for (let i = 0; i < chunks.length; i += wordsPerPhrase) {
    const wordGroup = chunks.slice(i, i + wordsPerPhrase);
    
    if (wordGroup.length > 0) {
      // Create a combined chunk from the word group
      const combinedChunk = {
        text: wordGroup.map(chunk => chunk.text).join(' ').trim(),
        timestamp: [
          wordGroup[0].timestamp[0], // Start time of first word
          wordGroup[wordGroup.length - 1].timestamp[1] // End time of last word
        ] as [number, number],
        words: wordGroup // Keep original words for reference
      };
      
      groupedChunks.push(combinedChunk);
    }
  }
  
  console.log(`Grouped ${chunks.length} words into ${groupedChunks.length} phrases`);
  return groupedChunks;
}

// Create FFmpeg subtitle filter string (deprecated - keeping for reference)
function createSubtitleFilter(subtitleStyle: SubtitleStyle, ratio: "16:9" | "9:16"): string {
  // For now, return empty string to use default SRT styling
  // We'll add custom styling once basic functionality works
  return '';
}

// Convert hex color to decimal for FFmpeg
function hexToDecimal(hex: string): number {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert RGB to BGR for FFmpeg (reverse order)
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // FFmpeg uses BGR format
  return (b << 16) | (g << 8) | r;
}
