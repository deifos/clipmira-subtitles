"use client";

import { SubtitleStyle } from "./subtitle-styling";
import { processTranscriptChunks } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

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
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [currentText, setCurrentText] = useState("");

  const processedChunks = processTranscriptChunks(transcript, mode);
  const currentChunks = processedChunks.filter(
    (chunk) =>
      currentTime >= chunk.timestamp[0] && currentTime <= chunk.timestamp[1]
  );

  useEffect(() => {
    const text =
      currentChunks.length > 0
        ? currentChunks.map((chunk) => chunk.text).join(" ")
        : "";

    if (text !== currentText) {
      // Reset animation states
      setIsAnimating(false);
      setIsSettling(false);

      // Set new text
      setCurrentText(text);

      // Trigger initial animation in the next frame
      requestAnimationFrame(() => {
        setIsAnimating(true);

        // After initial animation, start settling animation
        setTimeout(() => {
          setIsSettling(true);
        }, 200); // Faster initial animation
      });
    }
  }, [currentChunks, currentText]);

  if (currentChunks.length === 0) return null;

  const text = currentChunks.map((chunk) => chunk.text).join(" ");
  const words = text.split(" ");
  const midpoint = Math.ceil(words.length / 2);

  // Split text into two lines if in portrait mode or text is long
  const shouldSplitText = ratio === "9:16" || words.length > 8;
  const line1 = shouldSplitText ? words.slice(0, midpoint).join(" ") : text;
  const line2 = shouldSplitText ? words.slice(midpoint).join(" ") : "";

  // Animation states - more subtle
  const scale = !isAnimating ? 0 : isSettling ? 1 : 1.08; // Reduced from 1.25
  const translateY = !isAnimating ? 25 : isSettling ? 0 : -5; // Reduced from -15

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
        className="inline-block px-3 py-2"
        style={{
          backgroundColor: "transparent",
          transform: `scale(${scale}) translateY(${translateY}px)`,
          opacity: isAnimating ? 1 : 0,
          transition: isSettling
            ? "transform 0.15s cubic-bezier(0.34, 1.3, 0.64, 1)" // Less extreme bounce on return
            : "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1.4), opacity 0.08s ease-in", // More controlled bounce
        }}
      >
        <div className="flex flex-col gap-1">
          <span
            style={{
              color: style.color,
              textTransform: "uppercase",
              letterSpacing: "normal",
              background:
                style.color === "#CCCCCC" || style.color === "#C0C0C0"
                  ? "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)"
                  : style.color,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "none",
              WebkitTextStroke: `2px ${style.borderColor}`,
              filter: "drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.9))",
            }}
          >
            {line1}
          </span>
          {line2 && (
            <span
              style={{
                color: style.color,
                textTransform: "uppercase",
                letterSpacing: "normal",
                background:
                  style.color === "#CCCCCC" || style.color === "#C0C0C0"
                    ? "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)"
                    : style.color,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "none",
                WebkitTextStroke: `2px ${style.borderColor}`,
                filter: "drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.9))",
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
