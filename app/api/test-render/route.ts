import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'path';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { transcriptData, subtitleStyle, mode, ratio } = body;

    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'output');
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
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
        videoSrc: '', // Empty for still test
        transcriptData,
        subtitleStyle,
        mode,
        ratio,
      },
    });

    console.log('Composition found:', composition.id);

    // Generate output filename
    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `still_${timestamp}.png`);

    // Render a still frame
    console.log('Rendering still frame...');
    await renderStill({
      composition: {
        ...composition,
        fps: 30,
        width: ratio === '9:16' ? 720 : 1280,
        height: ratio === '9:16' ? 1280 : 720,
      },
      serveUrl: bundleLocation,
      output: outputPath,
      frame: 30, // 1 second at 30fps
      inputProps: {
        videoSrc: '',
        transcriptData,
        subtitleStyle,
        mode,
        ratio,
      },
    });

    console.log('Still frame rendered successfully:', outputPath);

    return NextResponse.json({ 
      success: true, 
      outputPath: `/output/still_${timestamp}.png`,
      message: 'Still frame rendered successfully' 
    });

  } catch (error) {
    console.error('Error rendering still:', error);
    return NextResponse.json(
      { error: 'Failed to render still', details: error.message },
      { status: 500 }
    );
  }
}