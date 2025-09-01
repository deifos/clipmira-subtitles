import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';

let bundleLocationCache: string | null = null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { videoSrc, transcriptData, subtitleStyle, mode, ratio, zoomPortrait, quality } = body as {
      videoSrc: string;
      transcriptData: any;
      subtitleStyle: any;
      mode: 'word' | 'phrase';
      ratio: '16:9' | '9:16';
      zoomPortrait?: boolean;
      quality?: 'low' | 'medium' | 'high';
    };

    console.log('Request body:', { videoSrc, transcriptData: !!transcriptData, subtitleStyle: !!subtitleStyle, mode, ratio });

    if (!transcriptData || !subtitleStyle) {
      return NextResponse.json({ error: 'Missing required parameters: transcriptData and subtitleStyle are required' }, { status: 400 });
    }

    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'output');
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    // Handle video source - convert base64 to temporary file if needed
    let actualVideoSrc = videoSrc;
    let tempVideoPath = '';
    
    if (videoSrc && videoSrc.startsWith('data:video/')) {
      // Extract base64 data and save as temporary file
      const base64Data = videoSrc.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      tempVideoPath = path.join(outputDir, `temp_video_${Date.now()}.mp4`);
      await writeFile(tempVideoPath, buffer);
      actualVideoSrc = tempVideoPath;
      console.log('Saved temporary video file:', tempVideoPath);
    }

    // Bundle the Remotion project (cache across requests to avoid rebundling)
    if (!bundleLocationCache) {
      console.log('Bundling Remotion project (cold start)...');
      bundleLocationCache = await bundle({
        entryPoint: path.join(process.cwd(), 'remotion/Root.tsx'),
        webpackOverride: (config) => {
          config.resolve = {
            ...config.resolve,
            alias: {
              ...config.resolve?.alias,
              '@': path.resolve(process.cwd()),
            },
          };
          return config;
        },
      });
    } else {
      console.log('Using cached Remotion bundle');
    }
    const bundleLocation = bundleLocationCache;

    // Get composition
    console.log('Getting composition...');
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'SubtitleVideo',
      inputProps: {
        videoSrc: actualVideoSrc,
        transcriptData,
        subtitleStyle,
        mode,
        ratio,
        zoomPortrait,
      },
    });

    console.log('Composition found:', composition.id);

    // Calculate duration based on video or transcript
    const lastChunk = transcriptData.chunks[transcriptData.chunks.length - 1];
    const videoDuration = lastChunk ? lastChunk.timestamp[1] : 30; // fallback to 30s
    // Quality presets
    const selectedQuality = quality || 'medium';
    const fps = selectedQuality === 'low' ? 24 : 30;
    const width = ratio === '9:16'
      ? (selectedQuality === 'high' ? 1080 : selectedQuality === 'medium' ? 720 : 540)
      : (selectedQuality === 'high' ? 1920 : selectedQuality === 'medium' ? 1280 : 960);
    const height = ratio === '9:16'
      ? (selectedQuality === 'high' ? 1920 : selectedQuality === 'medium' ? 1280 : 960)
      : (selectedQuality === 'high' ? 1080 : selectedQuality === 'medium' ? 720 : 540);
    const durationInFrames = Math.ceil(videoDuration * fps);

    // Generate output filename
    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `video_${timestamp}.mp4`);

    // Render the video
    console.log('Rendering video...');
    console.log('Render config:', {
      durationInFrames,
      fps,
      width,
      height,
      codec: 'h264',
      outputLocation: outputPath,
    });
    
    await renderMedia({
      composition: {
        ...composition,
        durationInFrames,
        fps,
        width,
        height,
      },
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      crf: selectedQuality === 'high' ? 20 : selectedQuality === 'medium' ? 24 : 28,
      x264Preset: 'veryfast',
      concurrency: 2,
      inputProps: {
        videoSrc: actualVideoSrc,
        transcriptData,
        subtitleStyle,
        mode,
        ratio,
        zoomPortrait,
      },
      onProgress: (progress) => {
        console.log(`Rendering progress: ${Math.round(progress * 100)}%`);
      },
    });

    console.log('Video rendered successfully:', outputPath);

    // Cleanup temporary video file if it was created
    if (tempVideoPath) {
      try {
        await unlink(tempVideoPath);
        console.log('Cleaned up temporary video file:', tempVideoPath);
      } catch (error) {
        console.warn('Could not clean up temporary file:', error);
      }
    }

    // Return the file path or URL
    return NextResponse.json({ 
      success: true, 
      outputPath: `/output/video_${timestamp}.mp4`,
      message: 'Video rendered successfully' 
    });

  } catch (error) {
    console.error('Error rendering video:', error);
    return NextResponse.json(
      { error: 'Failed to render video', details: error.message },
      { status: 500 }
    );
  }
}