import React from "react";
import { SubtitleStyle } from "../components/ui/subtitle-styling";
import { processTranscriptChunks } from "../lib/utils";

interface RemotionVideoCaptionProps {
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

export function RemotionVideoCaption({
  transcript,
  currentTime,
  style,
  mode,
  ratio,
}: RemotionVideoCaptionProps) {
  const processedChunks = processTranscriptChunks(transcript, mode);
  const enabledChunks = processedChunks.filter((chunk) => !chunk.disabled);

  // Find current subtitle chunks
  const currentChunks = enabledChunks.filter(
    (chunk) =>
      currentTime >= chunk.timestamp[0] && currentTime <= chunk.timestamp[1]
  );

  if (currentChunks.length === 0) {
    return null;
  }

  const text = currentChunks.map((chunk) => chunk.text).join(" ");
  const isVerticalVideo = ratio === "9:16";

  // Better text wrapping logic (same as original)
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

  // Exact same styling logic as original component
  const getTextStyle = () => {
    const baseStyle = {
      color: style.color,
      textTransform: "uppercase" as const,
      letterSpacing: "normal",
    };

    // Handle metallic gradient for specific colors (same as original)
    if (style.color === "#CCCCCC" || style.color === "#C0C0C0") {
      return {
        ...baseStyle,
        background: "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    }

    return baseStyle;
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: isVerticalVideo ? "8%" : "16%",
        left: "50%",
        transform: "translateX(-50%)",
        textAlign: "center",
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        maxWidth: isVerticalVideo ? "85%" : "90%",
        lineHeight: 1.2,
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "12px 24px",
          borderRadius: "8px",
          backgroundColor: style.backgroundColor !== "transparent" ? style.backgroundColor : undefined,
          textShadow: style.borderWidth > 0 ? 
            `${style.borderWidth}px ${style.borderWidth}px 0px ${style.borderColor}, -${style.borderWidth}px -${style.borderWidth}px 0px ${style.borderColor}, ${style.borderWidth}px -${style.borderWidth}px 0px ${style.borderColor}, -${style.borderWidth}px ${style.borderWidth}px 0px ${style.borderColor}` 
            : undefined,
        }}
      >
        {shouldSplitText ? (
          <>
            <div style={getTextStyle()}>{line1}</div>
            <div style={getTextStyle()}>{line2}</div>
          </>
        ) : (
          <span style={getTextStyle()}>{text}</span>
        )}
      </div>
    </div>
  );
}