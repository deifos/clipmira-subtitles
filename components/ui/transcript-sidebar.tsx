import { useMemo, useState, useRef, useEffect } from "react";
import {
  formatTime,
  transcriptToSrt,
  transcriptToVtt,
  processTranscriptChunks,
  type ProcessedChunk,
  type ProcessedWord,
} from "@/lib/utils";
import { Button } from "./button";
import { Edit, Ban, Undo2 } from "lucide-react";

interface TranscriptChunk {
  text: string;
  timestamp: [number, number];
  disabled?: boolean;
}

interface TranscriptSidebarProps {
  transcript: {
    text: string;
    chunks: TranscriptChunk[];
  };
  currentTime: number;
  setCurrentTime: (time: number) => void;
  onTranscriptUpdate?: (updatedTranscript: {
    text: string;
    chunks: TranscriptChunk[];
  }) => void;
  className?: string;
  mode: "word" | "phrase";
}

export function TranscriptSidebar({
  transcript,
  currentTime,
  setCurrentTime,
  onTranscriptUpdate,
  className = "",
  mode,
}: TranscriptSidebarProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const activeChunkRef = useRef<HTMLDivElement>(null);
  const [currentActiveElement, setCurrentActiveElement] = useState<HTMLDivElement | null>(null);

  // Process transcript chunks based on the current mode
  const displayChunks: ProcessedChunk[] = useMemo(() => {
    const processed = processTranscriptChunks(transcript, mode);

    return processed.map((chunk, index) => {
      if (mode === "phrase" && chunk.words) {
        const everyWordDisabled = chunk.words.every((word) =>
          transcript.chunks.some(
            (originalChunk) =>
              originalChunk.timestamp[0] === word.timestamp[0] &&
              originalChunk.timestamp[1] === word.timestamp[1] &&
              originalChunk.disabled
          )
        );

        return {
          ...chunk,
          disabled: everyWordDisabled,
        };
      }

      return {
        ...chunk,
        disabled: transcript.chunks[index]?.disabled ?? false,
      };
    });
  }, [transcript, mode]);

  // Add effect to scroll to active chunk when currentTime changes
  useEffect(() => {
    // Add a small delay to ensure the DOM has updated with the new active state
    const timeoutId = setTimeout(() => {
      if (currentActiveElement && transcriptContainerRef.current) {
        const container = transcriptContainerRef.current;
        const activeElement = currentActiveElement;
        
        
        // Use scrollTop and clientHeight to determine the actual visible scroll area
        const scrollTop = container.scrollTop;
        const clientHeight = container.clientHeight;
        const scrollBottom = scrollTop + clientHeight;
        
        // Get element position within the scrollable content
        const elementOffsetTop = activeElement.offsetTop;
        const elementOffsetBottom = elementOffsetTop + activeElement.offsetHeight;
        
        // Calculate if element is visible within the scrollable viewport
        const isElementAboveViewport = elementOffsetTop < scrollTop;
        const isElementBelowViewport = elementOffsetBottom > scrollBottom;
        
        
        if (isElementAboveViewport || isElementBelowViewport) {
          // Calculate the scroll position to center the element in the container
          const newScrollTop = elementOffsetTop - clientHeight / 2 + activeElement.offsetHeight / 2;
          
          // Smooth scroll within the container only
          container.scrollTo({
            top: Math.max(0, newScrollTop),
            behavior: "smooth"
          });
        }
      }
    }, 100); // Increased delay to ensure DOM updates

    return () => clearTimeout(timeoutId);
  }, [currentTime, currentActiveElement]);

  const jsonTranscript = useMemo(() => {
    return JSON.stringify(transcript, null, 2).replace(
      /( {4}"timestamp": )\[\s+(\S+)\s+(\S+)\s+\]/gm,
      "$1[$2 $3]"
    );
  }, [transcript]);

  const handleDownloadJson = () => {
    const blob = new Blob([jsonTranscript], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSrt = () => {
    const srtContent = transcriptToSrt(transcript, mode);
    const blob = new Blob([srtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.srt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadVtt = () => {
    const vttContent = transcriptToVtt(transcript, mode);
    const blob = new Blob([vttContent], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.vtt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditText(displayChunks[index].text);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;

    // For phrase mode, we need to handle editing differently
    // since we're editing processed chunks, not the original chunks
    if (mode === "phrase") {
      // In phrase mode, we would need more complex logic to update the original chunks
      // For now, we'll just update the display and show a warning
      console.warn("Editing in phrase mode is not fully supported yet. Changes may not persist.");
    }

    // Create a new transcript object with the updated chunk
    const updatedChunks = [...transcript.chunks];
    
    // For word mode, direct update
    if (mode === "word") {
      updatedChunks[editingIndex] = {
        ...updatedChunks[editingIndex],
        text: editText,
      };
    }

    const updatedTranscript = {
      text: updatedChunks.map((chunk) => chunk.text).join(" "),
      chunks: updatedChunks,
    };

    // Call the update function if provided
    if (onTranscriptUpdate) {
      onTranscriptUpdate(updatedTranscript);
    }

    // Reset editing state
    setEditingIndex(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  const toggleChunkDisabled = (index: number) => {
    if (mode === "phrase") {
      // For phrase mode, we need to toggle the disabled state of all word chunks
      // that make up this phrase
      const phraseToToggle = displayChunks[index];
      if (phraseToToggle.words) {
        const isCurrentlyDisabled = phraseToToggle.words.some((word: ProcessedWord) =>
          transcript.chunks.find(
            (chunk) =>
              chunk.timestamp[0] === word.timestamp[0] &&
              chunk.timestamp[1] === word.timestamp[1]
          )?.disabled
        );

        const updatedChunks = transcript.chunks.map((originalChunk) => {
          const isPartOfPhrase = phraseToToggle.words!.some((phraseWord) =>
            phraseWord.timestamp[0] === originalChunk.timestamp[0] &&
            phraseWord.timestamp[1] === originalChunk.timestamp[1]
          );
          
          if (isPartOfPhrase) {
            return { ...originalChunk, disabled: !isCurrentlyDisabled };
          }
          return originalChunk;
        });

        const updatedTranscript = {
          text: updatedChunks.filter(chunk => !chunk.disabled).map((chunk) => chunk.text).join(" "),
          chunks: updatedChunks,
        };

        if (onTranscriptUpdate) {
          onTranscriptUpdate(updatedTranscript);
        }
      }
    } else {
      // For word mode, direct toggle
      const updatedChunks = transcript.chunks.map((chunk, i) =>
        i === index ? { ...chunk, disabled: !chunk.disabled } : chunk
      );
      
      const updatedTranscript = {
        text: updatedChunks.filter(chunk => !chunk.disabled).map((chunk) => chunk.text).join(" "),
        chunks: updatedChunks,
      };

      if (onTranscriptUpdate) {
        onTranscriptUpdate(updatedTranscript);
      }
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex-1 overflow-y-auto max-h-96" ref={transcriptContainerRef}>
        <div className="space-y-2 p-2">
          {displayChunks.map((chunk, i) => {
            const [start, end] = chunk.timestamp;
            const isActive = start <= currentTime && currentTime <= end;
            const isEditing = editingIndex === i;

            // Check if this chunk is disabled
            const isDisabled = chunk.disabled ?? false;

            return (
              <div
                key={`${mode}-${i}-${start}`} // Include mode in key to force re-render when mode changes
                ref={isActive && !isDisabled ? (el) => {
                  if (el) {
                    setCurrentActiveElement(el);
                    activeChunkRef.current = el;
                  }
                } : null}
                className={`p-2 rounded ${
                  isEditing ? "bg-muted" : "hover:bg-muted cursor-pointer"
                } transition-colors ${
                  isActive && !isEditing
                    ? "bg-muted border-l-4 border-black"
                    : ""
                } ${
                  isDisabled ? "opacity-50 bg-gray-100 border-l-4 border-gray-400" : ""
                }`}
                onClick={() => {
                  if (!isEditing) {
                    setCurrentTime(start);
                  }
                }}
              >
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{formatTime(start)}</span>
                  <span>{formatTime(end)}</span>
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full p-2 border rounded-md text-sm min-h-[60px]"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEdit();
                        }}
                        variant="neutral"
                        size="sm"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveEdit();
                        }}
                        size="sm"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <p className={`${isActive ? "font-medium" : ""} ${isDisabled ? "line-through text-gray-500" : ""}`}>
                      {chunk.text}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(i);
                        }}
                        className="p-1"
                        title="Edit text"
                        size="icon"
                        variant="noShadow"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChunkDisabled(i);
                        }}
                        className={`p-1 ${
                          isDisabled
                            ? "text-emerald-600 hover:text-emerald-800"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                        title={isDisabled ? "Enable section" : "Disable section"}
                        size="icon"
                        variant="noShadow"
                      >
                        {isDisabled ? (
                          <Undo2 className="h-3 w-3" />
                        ) : (
                          <Ban className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t p-4 space-y-2">
        <div className="text-sm font-medium mb-2">Export Subtitles</div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleDownloadJson}
            className="flex items-center justify-center gap-1 px-3 py-2 "
          >
            <Edit />
            JSON
          </Button>

          <Button
            onClick={handleDownloadSrt}
            className="flex items-center justify-center gap-1 px-3 py-2 "
          >
            <Edit />
            SRT
          </Button>

          <Button
            onClick={handleDownloadVtt}
            className="flex items-center justify-center gap-1 px-3 py-2  col-span-2"
          >
            <Edit />
            WebVTT
          </Button>
        </div>
      </div>
    </div>
  );
}
