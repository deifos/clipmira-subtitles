import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { videoSrc, transcriptData, subtitleStyle, mode, ratio } = body;

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

    // Bundle the Remotion project
    console.log('Bundling Remotion project...');
    const bundleLocation = await bundle({
      entryPoint: path.join(process.cwd(), 'remotion/Root.tsx'),
      webpackOverride: (config) => {
        // Add path alias resolution
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
      },
    });

    console.log('Composition found:', composition.id);

    // Calculate duration based on video or transcript
    const lastChunk = transcriptData.chunks[transcriptData.chunks.length - 1];
    const videoDuration = lastChunk ? lastChunk.timestamp[1] : 30; // fallback to 30s
    const durationInFrames = Math.ceil(videoDuration * 30); // 30 fps

    // Generate output filename
    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `video_${timestamp}.mp4`);

    // Render the video
    console.log('Rendering video...');
    console.log('Render config:', {
      durationInFrames,
      fps: 30,
      width: ratio === '9:16' ? 720 : 1280,
      height: ratio === '9:16' ? 1280 : 720,
      codec: 'h264',
      outputLocation: outputPath,
    });
    
    await renderMedia({
      composition: {
        ...composition,
        durationInFrames,
        fps: 30, // Explicitly set fps
        width: ratio === '9:16' ? 720 : 1280,
        height: ratio === '9:16' ? 1280 : 720,
      },
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: {
        videoSrc: actualVideoSrc,
        transcriptData,
        subtitleStyle,
        mode,
        ratio,
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