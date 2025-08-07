import { Composition, registerRoot } from 'remotion';
import { SubtitleVideo } from './SubtitleVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SubtitleVideo"
        component={SubtitleVideo}
        durationInFrames={3000} // Will be dynamically set
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          videoSrc: '',
          transcriptData: null,
          subtitleStyle: null,
          mode: 'phrase' as 'word' | 'phrase',
          ratio: '16:9' as '16:9' | '9:16',
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);