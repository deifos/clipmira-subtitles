import { useCurrentFrame, useVideoConfig, Video, AbsoluteFill } from 'remotion';
import { RemotionVideoCaption } from './RemotionVideoCaption';
import { SubtitleStyle } from '../components/ui/subtitle-styling';

interface SubtitleVideoProps {
  videoSrc: string;
  transcriptData: {
    text: string;
    chunks: Array<{
      text: string;
      timestamp: [number, number];
      disabled?: boolean;
      words?: Array<{
        text: string;
        timestamp: [number, number];
      }>;
    }>;
  };
  subtitleStyle: SubtitleStyle;
  mode: 'word' | 'phrase';
  ratio: '16:9' | '9:16';
}

export const SubtitleVideo: React.FC<SubtitleVideoProps> = ({
  videoSrc,
  transcriptData,
  subtitleStyle,
  mode,
  ratio,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Convert frame to seconds
  const currentTime = frame / fps;

  if (!transcriptData || !subtitleStyle) {
    return null;
  }

  return (
    <AbsoluteFill>
      {/* Background Video or Color */}
      {videoSrc ? (
        <Video 
          src={videoSrc} 
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000000',
        }} />
      )}
      
      {/* Subtitle Overlay - Using Remotion-compatible component */}
      <AbsoluteFill>
        <RemotionVideoCaption
          transcript={transcriptData}
          currentTime={currentTime}
          style={subtitleStyle}
          mode={mode}
          ratio={ratio}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};