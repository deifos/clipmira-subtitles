import { Config } from '@remotion/cli/config';
import { enableTailwind } from '@remotion/tailwind';

Config.setEntryPoint('./remotion/Root.tsx');

// Enable Tailwind CSS support
enableTailwind();

// Set output location
Config.setOutputLocation('./output');

// Enable concurrent rendering for faster processing
Config.setConcurrency(4);

// Set video codec (h264 for better compatibility)
Config.setVideoCodec('h264');

// Set quality settings
Config.setImageFormat('jpeg');
Config.setQuality(85);

// Enable GPU acceleration if available
Config.setChromiumOpenGLRenderer('angle');