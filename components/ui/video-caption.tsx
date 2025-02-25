import { useMemo } from "react";

interface TranscriptChunk {
  text: string;
  timestamp: [number, number];
}

interface VideoCaptionProps {
  transcript: {
    text: string;
    chunks: TranscriptChunk[];
  };
  currentTime: number;
}

export function VideoCaption({ transcript, currentTime }: VideoCaptionProps) {
  const currentChunk = useMemo(() => {
    return transcript.chunks.find((chunk) => {
      const [start, end] = chunk.timestamp;
      return currentTime >= start && currentTime < end;
    });
  }, [transcript.chunks, currentTime]);

  if (!currentChunk) {
    return null;
  }

  return (
    <div className="absolute bottom-16 left-0 right-0 flex justify-center pointer-events-none">
      <div className="bg-black/75 text-white px-4 py-2 rounded-md text-center max-w-[90%]">
        {currentChunk.text}
      </div>
    </div>
  );
}
