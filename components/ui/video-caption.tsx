"use client";

import React, { useEffect, useState } from "react";
import { SubtitleStyle } from "./subtitle-styling";
import { processTranscriptChunks } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface VideoCaptionProps {
  transcript: {
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
  
  // Filter out disabled chunks for playback preview
  const enabledChunks = processedChunks.filter((chunk) => {
    if (mode === "phrase" && chunk.words) {
      // For phrase mode, check if any word in the phrase is disabled
      return !chunk.words.some(word => 
        transcript.chunks.find(originalChunk => 
          originalChunk.timestamp[0] === word.timestamp[0] && 
          originalChunk.timestamp[1] === word.timestamp[1]
        )?.disabled
      );
    } else {
      // For word mode, check if the chunk itself is disabled
      const originalChunkIndex = transcript.chunks.findIndex(
        originalChunk => 
          originalChunk.timestamp[0] === chunk.timestamp[0] && 
          originalChunk.timestamp[1] === chunk.timestamp[1]
      );
      return !transcript.chunks[originalChunkIndex]?.disabled;
    }
  });
  
  const currentChunks = enabledChunks.filter(
    (chunk) =>
      currentTime >= chunk.timestamp[0] && currentTime <= chunk.timestamp[1]
  );

  // For phrase mode, find the current word within the phrase
  const getCurrentWordInPhrase = (chunk: any) => {
    if (mode !== "phrase" || !chunk.words) return null;
    return chunk.words.find(
      (word: any) =>
        currentTime >= word.timestamp[0] && currentTime <= word.timestamp[1]
    );
  };

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

      // Only trigger animation if enabled
      if (style.animated) {
        // Trigger initial animation in the next frame
        requestAnimationFrame(() => {
          setIsAnimating(true);

          // After initial animation, start settling animation
          setTimeout(() => {
            setIsSettling(true);
          }, 200); // Faster initial animation
        });
      } else {
        // If animation is disabled, just show the text immediately
        setIsAnimating(true);
        setIsSettling(true);
      }
    }
  }, [currentChunks, currentText, style.animated]);

  if (currentChunks.length === 0) return null;

  const currentChunk = currentChunks[0]; // Take the first matching chunk
  const text = currentChunk.text;
  const currentWordInPhrase = getCurrentWordInPhrase(currentChunk);

  // Render function for phrase mode with word highlighting
  const renderPhraseWithHighlight = () => {
    if (mode !== "phrase" || !currentChunk.words) {
      return <span>{text}</span>;
    }

    return (
      <span>
        {currentChunk.words?.map((word: any, index: number) => {
          const isCurrentWord = currentWordInPhrase && word.text === currentWordInPhrase.text && 
                               word.timestamp[0] === currentWordInPhrase.timestamp[0];
          
          // Generate animation styles based on settings
          const getAnimationStyles = () => {
            if (!style.wordHighlightEnabled || !isCurrentWord) {
              return {};
            }

            const intensity = style.wordHighlightIntensity;
            const color = style.wordHighlightColor;
            
            switch (style.wordHighlightAnimation) {
              case "glow":
                return {
                  textShadow: `0 0 ${10 * intensity}px ${color}, 0 0 ${20 * intensity}px ${color}`,
                  filter: `brightness(${1 + intensity * 0.5})`,
                };
              case "scale":
                return {
                  transform: `scale(${1 + intensity * 0.3})`,
                  backgroundColor: `${color}${Math.round(intensity * 51).toString(16).padStart(2, '0')}`,
                };
              case "bounce":
                return {
                  animation: `wordBounce 0.6s ease-out`,
                  backgroundColor: `${color}${Math.round(intensity * 51).toString(16).padStart(2, '0')}`,
                };
              case "pulse":
                return {
                  animation: `wordPulse 1s ease-in-out infinite`,
                  backgroundColor: `${color}${Math.round(intensity * 51).toString(16).padStart(2, '0')}`,
                };
              default:
                return {
                  backgroundColor: `${color}${Math.round(intensity * 51).toString(16).padStart(2, '0')}`,
                };
            }
          };

          return (
            <React.Fragment key={`${word.timestamp[0]}-${index}`}>
              <span
                style={{
                  borderRadius: isCurrentWord && style.wordHighlightEnabled ? '3px' : '0',
                  padding: isCurrentWord && style.wordHighlightEnabled ? '2px 4px' : '0',
                  transition: 'all 0.15s ease-in-out',
                  fontWeight: isCurrentWord && style.wordHighlightEnabled ? 'bolder' : 'inherit',
                  display: 'inline-block',
                  ...getAnimationStyles(),
                }}
              >
                {word.text}
              </span>
              {index < (currentChunk.words?.length || 0) - 1 && (
                <span style={{ display: 'inline-block', width: '0.5em' }}> </span>
              )}
            </React.Fragment>
          );
        })}
      </span>
    );
  };

  // Better text wrapping logic
  const words = text.split(" ");
  const maxWordsPerLine = ratio === "9:16" ? 4 : 6; // Shorter lines for portrait
  const shouldSplitText = words.length > maxWordsPerLine;
  
  let line1 = text;
  let line2 = "";
  
  if (shouldSplitText) {
    // Try to split at natural break points
    const midpoint = Math.ceil(words.length / 2);
    let splitPoint = midpoint;
    
    // Look for natural break points (punctuation) near the middle
    for (let i = Math.max(2, midpoint - 2); i <= Math.min(words.length - 2, midpoint + 2); i++) {
      if (/[,;:.!?]$/.test(words[i])) {
        splitPoint = i + 1;
        break;
      }
    }
    
    line1 = words.slice(0, splitPoint).join(" ");
    line2 = words.slice(splitPoint).join(" ");
  }

  // Animation states - more subtle with shake
  const scale = !isAnimating ? 0 : isSettling ? 1 : 1.08;
  const translateY = !isAnimating ? 25 : isSettling ? 0 : -5;
  const translateX = !isAnimating
    ? 0
    : isSettling
    ? 0
    : Math.random() > 0.5
    ? 3
    : -3; // Add a slight random shake

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
          // Only set backgroundColor if we're not using a gradient
          ...(!(style.color === "#CCCCCC" || style.color === "#C0C0C0") && {
            backgroundColor: style.backgroundColor,
          }),
          // Only apply transform animation if enabled
          transform: style.animated
            ? `scale(${scale}) translateY(${translateY}px) translateX(${translateX}px)`
            : "scale(1) translateY(0)",
          opacity: isAnimating ? 1 : 0,
          // Only apply transition if animation is enabled
          transition: style.animated
            ? isSettling
              ? "transform 0.15s cubic-bezier(0.34, 1.3, 0.64, 1)"
              : "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1.4), opacity 0.08s ease-in"
            : "opacity 0.15s ease-in", // Simple fade in when animations disabled
        }}
      >
        <div className="flex flex-col gap-1">
          {mode === "phrase" && shouldSplitText ? (
            // For phrase mode with split text, we need to handle highlighting per line
            <>
              <span
                style={{
                  color: style.color,
                  textTransform: "uppercase",
                  letterSpacing: "normal",
                  ...(style.color === "#CCCCCC" || style.color === "#C0C0C0"
                    ? {
                        background:
                          "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }
                    : {}),
                  textShadow: "none",
                  WebkitTextStroke:
                    style.borderWidth > 0
                      ? `${style.borderWidth}px ${style.borderColor}`
                      : "none",
                  filter: `drop-shadow(2px 2px ${Math.max(
                    2,
                    style.dropShadowIntensity * 5
                  )}px rgba(0, 0, 0, ${style.dropShadowIntensity}))`,
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
                    ...(style.color === "#CCCCCC" || style.color === "#C0C0C0"
                      ? {
                          background:
                            "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }
                      : {}),
                    textShadow: "none",
                    WebkitTextStroke:
                      style.borderWidth > 0
                        ? `${style.borderWidth}px ${style.borderColor}`
                        : "none",
                    filter: `drop-shadow(2px 2px ${Math.max(
                      2,
                      style.dropShadowIntensity * 5
                    )}px rgba(0, 0, 0, ${style.dropShadowIntensity}))`,
                  }}
                >
                  {line2}
                </span>
              )}
            </>
          ) : (
            // Single line or word mode - use highlighting
            <span
              style={{
                color: style.color,
                textTransform: "uppercase",
                letterSpacing: "normal",
                ...(style.color === "#CCCCCC" || style.color === "#C0C0C0"
                  ? {
                      background:
                        "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }
                  : {}),
                textShadow: "none",
                WebkitTextStroke:
                  style.borderWidth > 0
                    ? `${style.borderWidth}px ${style.borderColor}`
                    : "none",
                filter: `drop-shadow(2px 2px ${Math.max(
                  2,
                  style.dropShadowIntensity * 5
                )}px rgba(0, 0, 0, ${style.dropShadowIntensity}))`,
              }}
            >
              {renderPhraseWithHighlight()}
            </span>
          )}
        </div>
      </div>
      
      {/* Add CSS animations for word highlighting */}
      <style jsx>{`
        @keyframes wordBounce {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        
        @keyframes wordPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
