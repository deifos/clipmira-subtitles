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
}

export function useVideoDownloadFFmpeg({
  videoRef,
  result,
  subtitleStyle,
  setStatus,
  setProgress,
  mode,
  ratio,
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
        const drawtextFilters = createDrawtextFilters(enabledChunks, subtitleStyle, ratio);
        console.log('Generated drawtext filters:', drawtextFilters.length);
        console.log('First filter example:', drawtextFilters[0]);
        
        const ffmpegCommand = [
          '-i', 'input.mp4',
          '-vf', drawtextFilters.join(','),
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
    
    // Add word-level highlighting if enabled and in phrase mode
    if (subtitleStyle.wordHighlightEnabled && chunk.words) {
      text = addWordHighlighting(text, chunk.words, subtitleStyle);
    }

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
function addWordHighlighting(text: string, words: any[], subtitleStyle: SubtitleStyle): string {
  // For now, return the text as-is since FFmpeg subtitle styling is limited
  // We could implement custom ASS styling here for more advanced effects
  return text;
}

// Create drawtext filters for each subtitle chunk
function createDrawtextFilters(chunks: any[], subtitleStyle: SubtitleStyle, ratio: "16:9" | "9:16"): string[] {
  const isVertical = ratio === "9:16";
  const filters: string[] = [];
  
  // Base font settings - simplified
  const fontSize = Math.max(subtitleStyle.fontSize, 32); // Larger for visibility
  
  chunks.forEach((chunk, index) => {
    const startTime = chunk.timestamp[0];
    const endTime = chunk.timestamp[1];
    // Clean text - remove extra spaces and escape properly
    const text = chunk.text.trim().replace(/'/g, "\\'");
    
    // Simple positioning - bottom center
    const yPosition = isVertical ? 'h-120' : 'h-100'; // More margin from bottom
    
    // Create drawtext filter with font file and proper syntax
    let filter = `drawtext=fontfile=font.ttf:text='${text}'`;
    filter += `:fontsize=${fontSize}`;
    filter += `:fontcolor=white`; // White text for visibility
    filter += `:x=(w-text_w)/2`; // Center horizontally
    filter += `:y=${yPosition}`; // Position from bottom
    filter += `:enable='between(t,${startTime},${endTime})'`; // Simplified enable syntax
    
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
