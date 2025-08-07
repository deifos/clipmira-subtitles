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
      
      if (enabledChunks.length === 0) {
        console.error('No enabled chunks found!');
        console.log('All processed chunks:', processedChunks);
        throw new Error('No subtitle content to process');
      }
      
      console.log('Sample chunk:', enabledChunks[0]);

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

      // First test: try simple copy without any filters
      console.log('Testing simple video copy first...');
      
      const testCommand = [
        '-i', 'input.mp4',
        '-c', 'copy', // Copy everything without re-encoding
        '-y', // Overwrite output file
        'test_copy.mp4'
      ];
      
      try {
        await ffmpeg.exec(testCommand);
        console.log('Simple copy test successful');
        
        // Now try with subtitles
        const drawtextFilters = createDrawtextFilters(enabledChunks, subtitleStyle, ratio, videoFit);
        console.log('Generated drawtext filters:', drawtextFilters.length);
        console.log('First filter example:', drawtextFilters[0]);
        
        // Add video scaling based on ratio and fit mode
        let videoFilters = [];
        
        if (ratio === "9:16") {
          // Portrait mode - scale video to fit 720x1280
          const targetWidth = 720;
          const targetHeight = 1280;
          
          if (videoFit === "contain") {
            // Fit video within bounds, add black bars if needed
            videoFilters.push(`scale=w=${targetWidth}:h=${targetHeight}:force_original_aspect_ratio=decrease`);
            videoFilters.push(`pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`);
          } else if (videoFit === "cover") {
            // Crop video to fill bounds
            videoFilters.push(`scale=w=${targetWidth}:h=${targetHeight}:force_original_aspect_ratio=increase`);
            videoFilters.push(`crop=${targetWidth}:${targetHeight}`);
          } else if (videoFit === "fill") {
            // Stretch video to exact bounds
            videoFilters.push(`scale=${targetWidth}:${targetHeight}`);
          }
        } else {
          // Landscape mode - scale video to fit 1280x720
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
        
        // Combine video scaling filters with subtitle filters
        const allFilters = [...videoFilters, ...drawtextFilters];
        
        const ffmpegCommand = [
          '-i', 'input.mp4',
          '-vf', allFilters.join(','),
          '-c:a', 'copy', // Copy audio without re-encoding
          '-y', // Overwrite output file
          'output.mp4'
        ];
        
        console.log('FFmpeg command:', ffmpegCommand.join(' '));
        await ffmpeg.exec(ffmpegCommand);
        
      } catch (testError) {
        console.error('Simple copy test failed:', testError);
        // If even simple copy fails, there's a fundamental issue
        throw new Error(`FFmpeg basic functionality failed: ${testError}`);
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

      // Cleanup FFmpeg
      ffmpeg.terminate();

    } catch (error) {
      console.error("Error processing video with FFmpeg:", error);
      setStatus("idle");
      setProgress(0);
    }
  };

  return { handleDownloadVideo };
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
  
  // Scale font size appropriately for video
  const fontSize = Math.max(subtitleStyle.fontSize * 1.5, 32); // Scale up for video visibility
  
  // Convert hex color to FFmpeg format (remove #)
  const fontColor = subtitleStyle.color.replace('#', '');
  const borderColor = subtitleStyle.borderColor.replace('#', '');
  
  chunks.forEach((chunk, index) => {
    const startTime = chunk.timestamp[0];
    const endTime = chunk.timestamp[1];
    // Clean text - remove extra spaces and escape properly
    const text = chunk.text.trim().replace(/'/g, "\\'");
    
    // Positioning based on aspect ratio
    const yPosition = isVertical ? 'h-h*0.15' : 'h-h*0.12'; // Percentage-based positioning
    
    // Create drawtext filter with full styling
    let filter = `drawtext=fontfile=font.ttf:text='${text.toUpperCase()}'`; // Uppercase like preview
    filter += `:fontsize=${fontSize}`;
    filter += `:fontcolor=${fontColor}`; // Use user's color choice
    
    // Make font bold/heavy to match preview weight
    // Note: Limited font weight control in drawtext, but we can simulate with border
    if (subtitleStyle.fontWeight === '700' || subtitleStyle.fontWeight === '800' || subtitleStyle.fontWeight === '900' || subtitleStyle.fontWeight === 'bold') {
      // Add a subtle same-color border to make text appear bolder
      filter += `:borderw=1:bordercolor=${fontColor}`;
    }
    
    // Add border/outline if specified (in addition to bold effect)
    if (subtitleStyle.borderWidth > 0) {
      filter += `:borderw=${subtitleStyle.borderWidth * 2}`; // Scale border for visibility
      filter += `:bordercolor=${borderColor}`;
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
    
    filters.push(filter);
  });
  
  return filters;
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
