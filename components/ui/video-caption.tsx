import { useMemo } from "react";
import { SubtitleStyle } from "./subtitle-styling";

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
  style: SubtitleStyle;
}

export function VideoCaption({
  transcript,
  currentTime,
  style,
}: VideoCaptionProps) {
  const currentChunk = useMemo(() => {
    return transcript.chunks.find((chunk) => {
      const [start, end] = chunk.timestamp;
      return currentTime >= start && currentTime < end;
    });
  }, [transcript.chunks, currentTime]);

  if (!currentChunk) {
    return null;
  }

  // Create text-shadow for text outline effect
  const getTextShadow = () => {
    if (style.borderWidth <= 0) return "none";

    const color = style.borderColor;

    // Create a simpler text stroke effect using -webkit-text-stroke
    // For browsers that don't support it, we'll use a simplified text-shadow as fallback
    return `-1px -1px 0 ${color}, 1px -1px 0 ${color}, -1px 1px 0 ${color}, 1px 1px 0 ${color}`;
  };

  return (
    <div className="absolute bottom-16 left-0 right-0 flex justify-center pointer-events-none">
      <div
        className="px-4 py-2 rounded-md text-center max-w-[90%]"
        style={{
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          color: style.color,
          backgroundColor: style.backgroundColor,
          textShadow: getTextShadow(),
          WebkitTextStroke:
            style.borderWidth > 0
              ? `${style.borderWidth}px ${style.borderColor}`
              : "none",
          letterSpacing: style.borderWidth > 2 ? "0.5px" : "normal", // Add letter spacing for better readability with thick borders
        }}
      >
        {currentChunk.text}
      </div>
    </div>
  );
}
