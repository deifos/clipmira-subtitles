"use client";

import { SubtitleStyle } from "./subtitle-styling";
import { processTranscriptChunks } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface VideoCaptionProps {
  transcript: {
    text: string;
    chunks: Array<{
      text: string;
      timestamp: [number, number];
    }>;
  };
  currentTime: number;
  style: SubtitleStyle;
  mode: "word" | "phrase";
  ratio: "16:9" | "9:16";
}

export function VideoCaption({
  transcript,
  currentTime,
  style,
  mode,
  ratio,
}: VideoCaptionProps) {
  const processedChunks = processTranscriptChunks(transcript, mode);
  const currentChunks = processedChunks.filter(
    (chunk) =>
      currentTime >= chunk.timestamp[0] && currentTime <= chunk.timestamp[1]
  );

  if (currentChunks.length === 0) return null;

  const text = currentChunks.map((chunk) => chunk.text).join(" ");
  const words = text.split(" ");
  const midpoint = Math.ceil(words.length / 2);

  // Split text into two lines if in portrait mode or text is long
  const shouldSplitText = ratio === "9:16" || words.length > 8;
  const line1 = shouldSplitText ? words.slice(0, midpoint).join(" ") : text;
  const line2 = shouldSplitText ? words.slice(midpoint).join(" ") : "";

  return (
    <div
      className={cn(
        "absolute left-1/2 -translate-x-1/2 text-center",
        ratio === "16:9"
          ? "bottom-[16%] w-[90%]" // Landscape mode
          : "bottom-[8%] w-[85%]" // Portrait mode
      )}
      style={{
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      }}
    >
      <div
        className="inline-block px-3 py-2 rounded-lg"
        style={{
          backgroundColor: style.backgroundColor,
        }}
      >
        <div className="flex flex-col gap-1">
          <span
            style={{
              color: style.color,
              textShadow: style.borderWidth
                ? `${style.borderWidth}px ${style.borderWidth}px ${style.borderWidth}px ${style.borderColor}`
                : undefined,
            }}
          >
            {line1}
          </span>
          {line2 && (
            <span
              style={{
                color: style.color,
                textShadow: style.borderWidth
                  ? `${style.borderWidth}px ${style.borderWidth}px ${style.borderWidth}px ${style.borderColor}`
                  : undefined,
              }}
            >
              {line2}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
