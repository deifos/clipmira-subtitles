import { CSSProperties, ChangeEvent, useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export interface SubtitleStyle {
  fontFamily: string; // Note: FFmpeg uses single font file, family switching limited
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  dropShadowIntensity: number;
  wordEmphasisEnabled: boolean;
  // Removed: animated, wordHighlightEnabled, wordHighlightColor, wordHighlightAnimation, wordHighlightIntensity
  // FFmpeg drawtext doesn't support animations or word highlighting
}

interface SubtitleStylingProps {
  style: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
  className?: string;
}

const fontOptions = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "var(--font-montserrat), Arial, sans-serif", label: "Montserrat" },
  { value: "var(--font-poppins), Arial, sans-serif", label: "Poppins" },
  { value: "var(--font-roboto), Arial, sans-serif", label: "Roboto" },
  { value: "var(--font-open-sans), Arial, sans-serif", label: "Open Sans" },
  { value: "var(--font-bebas-neue), Arial, sans-serif", label: "Bebas Neue" },
  { value: "var(--font-oswald), Arial, sans-serif", label: "Oswald" },
  { value: "var(--font-anton), Arial, sans-serif", label: "Anton" },
  { value: "var(--font-bangers), Arial, sans-serif", label: "Bangers" },
  { value: "var(--font-fredoka), Arial, sans-serif", label: "Fredoka" },
  { value: "var(--font-righteous), Arial, sans-serif", label: "Righteous" },
  { value: "var(--font-nunito), Arial, sans-serif", label: "Nunito" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Courier New, monospace", label: "Courier" },
];

const fontSizeOptions = [
  { value: 16, label: "Small" },
  { value: 20, label: "Medium" },
  { value: 24, label: "Large" },
  { value: 28, label: "X Large" },
  { value: 32, label: "XX Large" },
  { value: 42, label: "Huge" },
];

const fontWeightOptions = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
];

const borderWidthOptions = [
  { value: 0, label: "None" },
  { value: 1, label: "Thin" },
  { value: 2, label: "Medium" },
  { value: 4, label: "Thick" },
];

type SubtitlePresetName =
  | "important"
  | "green"
  | "gold"
  | "subtitle"
  | "tiktok"
  | "gamer";

interface SubtitlePreset {
  name: SubtitlePresetName;
  label: string;
  previewText: string;
  style: Partial<SubtitleStyle>;
  inactiveStyles?: CSSProperties;
}

const PRESETS: SubtitlePreset[] = [
  {
    name: "important",
    label: "Important",
    previewText: "IMPORTANT",
    style: {
      fontFamily: "var(--font-bebas-neue), Arial, sans-serif",
      fontSize: 28,
      fontWeight: "500",
      color: "#D9D9D9",
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: "#000000",
      dropShadowIntensity: 0.6,
    },
    inactiveStyles: {
      background:
        "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      textShadow: "0px 1px 2px rgba(0, 0, 0, 0.5)",
    },
  },
  {
    name: "green",
    label: "Green",
    previewText: "GREEN",
    style: {
      fontFamily: "var(--font-oswald), Arial, sans-serif",
      fontSize: 28,
      fontWeight: "600",
      color: "#00FF41",
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: "#000000",
      dropShadowIntensity: 0.6,
    },
    inactiveStyles: {
      color: "#00FF41",
      backgroundColor: "transparent",
      textShadow: "0px 0px 3px #000000, 0px 0px 2px #000000",
    },
  },
  {
    name: "gold",
    label: "Gold",
    previewText: "GOLD",
    style: {
      fontFamily: "var(--font-poppins), Arial, sans-serif",
      fontSize: 24,
      fontWeight: "600",
      color: "#FFD700",
      backgroundColor: "#000000",
      borderWidth: 0,
      borderColor: "#000000",
      dropShadowIntensity: 0.5,
    },
    inactiveStyles: {
      color: "#FFD700",
      backgroundColor: "#000000",
    },
  },
  {
    name: "subtitle",
    label: "Subtitle",
    previewText: "SUBTITLE",
    style: {
      fontFamily: "var(--font-open-sans), Arial, sans-serif",
      fontSize: 20,
      fontWeight: "500",
      color: "#FFFFFF",
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      borderWidth: 0,
      borderColor: "#000000",
      dropShadowIntensity: 0.4,
    },
    inactiveStyles: {
      color: "#FFFFFF",
      backgroundColor: "rgba(0, 0, 0, 0.8)",
    },
  },
  {
    name: "tiktok",
    label: "TikTok",
    previewText: "TIKTOK",
    style: {
      fontFamily: "var(--font-montserrat), Arial, sans-serif",
      fontSize: 32,
      fontWeight: "700",
      color: "#FFFFFF",
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: "#FF1493",
      dropShadowIntensity: 0.7,
    },
    inactiveStyles: {
      color: "#FFFFFF",
      backgroundColor: "transparent",
      border: "2px solid #FF1493",
    },
  },
  {
    name: "gamer",
    label: "Gamer",
    previewText: "GAMER",
    style: {
      fontFamily: "var(--font-bangers), Arial, sans-serif",
      fontSize: 32,
      fontWeight: "600",
      color: "#00FFFF",
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: "#FF00FF",
      dropShadowIntensity: 0.7,
    },
    inactiveStyles: {
      color: "#00FFFF",
      backgroundColor: "transparent",
      border: "2px solid #FF00FF",
    },
  },
];

interface PresetButtonProps {
  preset: SubtitlePreset;
  isActive: boolean;
  onApply: () => void;
}

function PresetButton({ preset, isActive, onApply }: PresetButtonProps) {
  return (
    <Button
      onClick={onApply}
      variant={isActive ? "default" : "neutral"}
      className="text-xs font-semibold h-8"
      style={isActive ? undefined : preset.inactiveStyles}
    >
      {preset.label.toUpperCase()}
    </Button>
  );
}

function isPresetActive(style: SubtitleStyle, preset: SubtitlePreset) {
  return Object.entries(preset.style).every(([key, value]) => {
    const styleValue = style[key as keyof SubtitleStyle];
    return styleValue === value;
  });
}

export function SubtitleStyling({
  style,
  onChange,
  className = "",
}: SubtitleStylingProps) {
  const activePresetName = useMemo<SubtitlePresetName | null>(() => {
    const match = PRESETS.find((preset) => isPresetActive(style, preset));
    return match ? match.name : null;
  }, [style]);

  const previewText = useMemo(() => {
    const match = PRESETS.find((preset) => preset.name === activePresetName);
    return match?.previewText ?? "PREVIEW";
  }, [activePresetName]);

  const handleFontFamilyChange = (value: string) => {
    onChange({ ...style, fontFamily: value });
  };

  const handleFontSizeChange = (value: string) => {
    onChange({ ...style, fontSize: Number(value) });
  };

  const handleFontWeightChange = (value: string) => {
    onChange({ ...style, fontWeight: value });
  };

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...style, color: event.target.value });
  };

  const handleBackgroundColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...style, backgroundColor: event.target.value });
  };

  const handleBorderWidthChange = (value: string) => {
    onChange({ ...style, borderWidth: Number(value) });
  };

  const handleBorderColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...style, borderColor: event.target.value });
  };

  const handleDropShadowIntensityChange = (value: number) => {
    onChange({ ...style, dropShadowIntensity: value });
  };

  const handleWordEmphasisToggle = (value: boolean) => {
    onChange({ ...style, wordEmphasisEnabled: value });
  };

  const applyPreset = (preset: SubtitlePreset) => {
    onChange({ ...style, ...preset.style });
  };

  const previewStyles = useMemo(() => {
    const base: CSSProperties = {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      color: style.color,
      WebkitTextStroke:
        style.borderWidth > 0 ? `${Math.max(0.5, style.borderWidth * 1.5)}px ${style.borderColor}` : "none",
      letterSpacing: "0.05em",
      filter: `drop-shadow(2px 2px ${Math.max(2, style.dropShadowIntensity * 7)}px rgba(0, 0, 0, ${style.dropShadowIntensity}))`,
      borderRadius: "0.5rem",
      transition: "all 0.2s ease",
    };

    if (activePresetName === "important") {
      return {
        ...base,
        background:
          "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      };
    }

    return {
      ...base,
      backgroundColor: style.backgroundColor,
    };
  }, [style, activePresetName]);

  const wordEmphasisEnabled = style.wordEmphasisEnabled ?? true;

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      <div className="px-4 mb-2">
        <h3 className="font-medium text-lg">Subtitle Styling</h3>
      </div>

      <div className="p-2 space-y-3 flex-1 overflow-y-auto">
        <div className="space-y-2 mb-2">
          <label className="text-sm font-medium block">Style Presets</label>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <PresetButton
                key={preset.name}
                preset={preset}
                isActive={activePresetName === preset.name}
                onApply={() => applyPreset(preset)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-1 pb-1 border-t border-b">
          <Select value={style.fontFamily} onValueChange={handleFontFamilyChange}>
            <SelectTrigger className="w-full p-2 border rounded-md bg-background">
              <SelectValue placeholder="Select a font" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fontOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Font Size</label>
          <Select value={style.fontSize.toString()} onValueChange={handleFontSizeChange}>
            <SelectTrigger className="w-full p-2 border rounded-md bg-background">
              <SelectValue placeholder="Select a size" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fontSizeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Font Weight</label>
          <Select value={style.fontWeight} onValueChange={handleFontWeightChange}>
            <SelectTrigger className="w-full p-2 border rounded-md bg-background">
              <SelectValue placeholder="Select a weight" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fontWeightOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Text Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={style.color}
              onChange={handleColorChange}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <span className="text-sm uppercase">{style.color}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Background Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={style.backgroundColor}
              onChange={handleBackgroundColorChange}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <span className="text-sm uppercase">{style.backgroundColor}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Border Width</label>
          <Select value={style.borderWidth.toString()} onValueChange={handleBorderWidthChange}>
            <SelectTrigger className="w-full p-2 border rounded-md bg-background">
              <SelectValue placeholder="Select a border width" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {borderWidthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {style.borderWidth > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium block">Border Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.borderColor}
                onChange={handleBorderColorChange}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <span className="text-sm uppercase">{style.borderColor}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium block">Drop Shadow Intensity</label>
          <Slider
            value={[Math.round(style.dropShadowIntensity * 100)]}
            onValueChange={(values) => handleDropShadowIntensityChange(values[0] / 100)}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Subtle</span>
            <span>Strong</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
          <div>
            <p className="text-sm font-medium">Active word emphasis</p>
            <p className="text-xs text-muted-foreground">
              Scale the spoken word and add a subtle dark backdrop.
            </p>
          </div>
          <Switch
            checked={wordEmphasisEnabled}
            onCheckedChange={handleWordEmphasisToggle}
            aria-label="Toggle active word emphasis"
          />
        </div>
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Preview</h4>
        <div className="p-4 rounded-md text-center" style={previewStyles}>
          {previewText}
        </div>
      </div>
    </div>
  );
}
