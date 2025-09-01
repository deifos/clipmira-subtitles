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

export interface SubtitleStyle {
  fontFamily: string; // Note: FFmpeg uses single font file, family switching limited
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  dropShadowIntensity: number;
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
  { value: "normal", label: "Normal" },
  { value: "bold", label: "Bold" },
  { value: "800", label: "Extra Bold" },
  { value: "900", label: "Black" },
];

const borderWidthOptions = [
  { value: 0, label: "None" },
  { value: 1, label: "Thin" },
  { value: 2, label: "Medium" },
  { value: 4, label: "Thick" },
];

export function SubtitleStyling({
  style,
  onChange,
  className = "",
}: SubtitleStylingProps) {
  const handleFontFamilyChange = (value: string) => {
    onChange({ ...style, fontFamily: value });
  };

  const handleFontSizeChange = (value: string) => {
    onChange({ ...style, fontSize: Number(value) });
  };

  const handleFontWeightChange = (value: string) => {
    onChange({ ...style, fontWeight: value });
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...style, color: e.target.value });
  };

  const handleBackgroundColorChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({ ...style, backgroundColor: e.target.value });
  };

  const handleBorderWidthChange = (value: string) => {
    onChange({ ...style, borderWidth: Number(value) });
  };

  const handleBorderColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...style, borderColor: e.target.value });
  };

  const handleDropShadowIntensityChange = (value: string) => {
    onChange({ ...style, dropShadowIntensity: Number(value) });
  };

  // Enhanced preset styles with better sizing for CapCut-like experience
  const applyImportantStyle = () => {
    onChange({
      ...style,
      fontFamily: "var(--font-bebas-neue), Arial, sans-serif",
      fontSize: 28, // Now uses "X Large" option for impact
      fontWeight: "normal", // Fixed: was "400", now matches "Normal" option
      color: "#CCCCCC", // Metallic silver
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: "#000000",
      dropShadowIntensity: 0.8,
    });
  };

  // Enhanced green preset with better sizing
  const applyGreenStyle = () => {
    onChange({
      ...style,
      fontFamily: "var(--font-oswald), Arial, sans-serif",
      fontSize: 28, // Now uses "X Large" option for better visibility
      fontWeight: "bold", // Fixed: was "600", now matches "Bold" option
      color: "#00FF41", // Matrix green
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: "#000000",
      dropShadowIntensity: 0.7,
    });
  };

  // Enhanced yellow preset with better styling
  const applyYellowStyle = () => {
    onChange({
      ...style,
      fontFamily: "var(--font-poppins), Arial, sans-serif",
      fontSize: 24, // Already correct - matches "Large" option
      fontWeight: "bold", // Fixed: was "700", now matches "Bold" option
      color: "#FFD700", // Gold instead of bright yellow
      backgroundColor: "#000000",
      borderWidth: 0,
      borderColor: "#000000",
      dropShadowIntensity: 0.6,
    });
  };


  // Enhanced subtitle preset for professional look
  const applySubtitleStyle = () => {
    onChange({
      ...style,
      fontFamily: "var(--font-open-sans), Arial, sans-serif",
      fontSize: 20, // Fixed: was 22, now matches "Medium" option
      fontWeight: "bold", // Fixed: was "600", now matches "Bold" option
      color: "#FFFFFF",
      backgroundColor: "rgba(0, 0, 0, 0.8)", // Semi-transparent black
      borderWidth: 0,
      borderColor: "#000000",
      dropShadowIntensity: 0.4,
    });
  };

  // New preset: TikTok/Instagram style
  const applyTikTokStyle = () => {
    onChange({
      ...style,
      fontFamily: "var(--font-montserrat), Arial, sans-serif",
      fontSize: 32, // Now uses "XX Large" option for TikTok impact
      fontWeight: "800", // Already correct - matches "Extra Bold" option
      color: "#FFFFFF",
      backgroundColor: "transparent",
      borderWidth: 3,
      borderColor: "#FF1493", // Hot pink border
      dropShadowIntensity: 0.9,
    });
  };

  // New preset: Gaming/Streamer style
  const applyGamerStyle = () => {
    onChange({
      ...style,
      fontFamily: "var(--font-bangers), Arial, sans-serif",
      fontSize: 42, // Fixed: was 28, now matches "X Large" option for impact
      fontWeight: "normal", // Fixed: was "400", now matches "Normal" option
      color: "#00FFFF", // Cyan
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: "#FF00FF", // Magenta border
      dropShadowIntensity: 0.8,
    });
  };

  // Check if current style matches a preset
  const isImportantActive =
    style.fontFamily === "var(--font-bebas-neue), Arial, sans-serif" &&
    style.fontSize === 28 &&
    style.fontWeight === "400" &&
    style.color === "#CCCCCC";

  const isGreenActive =
    style.fontFamily === "var(--font-oswald), Arial, sans-serif" &&
    style.fontSize === 26 &&
    style.fontWeight === "600" &&
    style.color === "#00FF41";

  const isYellowActive =
    style.fontFamily === "var(--font-poppins), Arial, sans-serif" &&
    style.fontSize === 24 &&
    style.fontWeight === "700" &&
    style.color === "#FFD700" &&
    style.backgroundColor === "#000000";

  const isSubtitleActive =
    style.fontFamily === "var(--font-open-sans), Arial, sans-serif" &&
    style.fontSize === 22 &&
    style.fontWeight === "600" &&
    style.color === "#FFFFFF" &&
    style.backgroundColor === "rgba(0, 0, 0, 0.8)";

  const isTikTokActive =
    style.fontFamily === "var(--font-montserrat), Arial, sans-serif" &&
    style.fontSize === 26 &&
    style.fontWeight === "800" &&
    style.color === "#FFFFFF" &&
    style.borderColor === "#FF1493";

  const isGamerActive =
    style.fontFamily === "var(--font-bangers), Arial, sans-serif" &&
    style.fontSize === 28 &&
    style.fontWeight === "400" &&
    style.color === "#00FFFF" &&
    style.borderColor === "#FF00FF";

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      <div className="px-4 mb-2">
        <h3 className="font-medium text-lg">Subtitle Styling</h3>
      </div>

      <div className="p-2 space-y-3 flex-1 overflow-y-auto">
        {/* Presets */}
        <div className="space-y-2 mb-2">
          <label className="text-sm font-medium block">Style Presets</label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={applyImportantStyle}
              variant={isImportantActive ? "default" : "neutral"}
              className="text-xs font-bold h-8"
              style={{
                background: isImportantActive ? undefined :
                  "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)",
                WebkitBackgroundClip: isImportantActive ? undefined : "text",
                WebkitTextFillColor: isImportantActive ? undefined : "transparent",
                textShadow: isImportantActive ? undefined : "0px 1px 2px rgba(0, 0, 0, 0.5)",
              }}
            >
              IMPORTANT
            </Button>
            <Button
              onClick={applyGreenStyle}
              variant={isGreenActive ? "default" : "neutral"}
              className="text-xs font-bold h-8"
              style={{
                color: isGreenActive ? undefined : "#00FF41",
                backgroundColor: isGreenActive ? undefined : "transparent",
                textShadow: isGreenActive ? undefined : "0px 0px 3px #000000, 0px 0px 2px #000000",
              }}
            >
              GREEN
            </Button>
            <Button
              onClick={applyYellowStyle}
              variant={isYellowActive ? "default" : "neutral"}
              className="text-xs font-bold h-8"
              style={{
                color: isYellowActive ? undefined : "#FFD700",
                backgroundColor: isYellowActive ? undefined : "#000000",
              }}
            >
              GOLD
            </Button>
            <Button
              onClick={applySubtitleStyle}
              variant={isSubtitleActive ? "default" : "neutral"}
              className="text-xs font-bold h-8"
              style={{
                color: isSubtitleActive ? undefined : "#FFFFFF",
                backgroundColor: isSubtitleActive ? undefined : "rgba(0, 0, 0, 0.8)",
              }}
            >
              SUBTITLE
            </Button>
            <Button
              onClick={applyTikTokStyle}
              variant={isTikTokActive ? "default" : "neutral"}
              className="text-xs font-bold h-8"
              style={{
                color: isTikTokActive ? undefined : "#FFFFFF",
                backgroundColor: isTikTokActive ? undefined : "transparent",
                border: isTikTokActive ? undefined : "2px solid #FF1493",
              }}
            >
              TIKTOK
            </Button>
            <Button
              onClick={applyGamerStyle}
              variant={isGamerActive ? "default" : "neutral"}
              className="text-xs font-bold h-8"
              style={{
                color: isGamerActive ? undefined : "#00FFFF",
                backgroundColor: isGamerActive ? undefined : "transparent",
                border: isGamerActive ? undefined : "2px solid #FF00FF",
              }}
            >
              GAMER
            </Button>
          </div>
        </div>

        {/* Add animation toggle switch after the presets */}
        <div className="space-y-2 pt-1 pb-1 border-t border-b">
          <Select
            value={style.fontFamily}
            onValueChange={handleFontFamilyChange}
          >
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
          <Select
            value={style.fontSize.toString()}
            onValueChange={handleFontSizeChange}
          >
            <SelectTrigger className="w-full p-2 border rounded-md bg-background">
              <SelectValue placeholder="Select a size" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fontSizeOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value.toString()}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Font Weight</label>
          <Select
            value={style.fontWeight}
            onValueChange={handleFontWeightChange}
          >
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
            <span className="text-sm">{style.color}</span>
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
            <span className="text-sm">{style.backgroundColor}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Border Width</label>
          <Select
            value={style.borderWidth.toString()}
            onValueChange={handleBorderWidthChange}
          >
            <SelectTrigger className="w-full p-2 border rounded-md bg-background">
              <SelectValue placeholder="Select a border width" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {borderWidthOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value.toString()}
                  >
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
              <span className="text-sm">{style.borderColor}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium block">
            Drop Shadow Intensity
          </label>
          <Slider
            value={[style.dropShadowIntensity * 100]}
            onValueChange={(values) =>
              handleDropShadowIntensityChange((values[0] / 100).toString())
            }
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>None</span>
            <span>Strong</span>
          </div>
        </div>

        {/* Animation and word highlighting removed - not supported by FFmpeg drawtext */}
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Preview</h4>
        <div
          className="p-3 rounded-md text-center preview-animation"
          style={{
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            letterSpacing: "normal",
            textTransform: "uppercase",
            color: style.color,
            // Only set backgroundColor if we're not using a gradient
            ...(!(style.color === "#CCCCCC" || style.color === "#C0C0C0") && {
              backgroundColor: style.backgroundColor,
            }),
            ...(style.color === "#CCCCCC" || style.color === "#C0C0C0"
              ? {
                  background:
                    "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }
              : {}),
            WebkitTextStroke:
              style.borderWidth > 0
                ? `${style.borderWidth}px ${style.borderColor}`
                : "none",
            filter: `drop-shadow(2px 2px ${Math.max(
              2,
              style.dropShadowIntensity * 5
            )}px rgba(0, 0, 0, ${style.dropShadowIntensity}))`,
            // Animation removed - not supported by FFmpeg drawtext
          }}
        >
          {isImportantActive ? "IMPORTANT" :
           isGreenActive ? "GREEN" :
           isYellowActive ? "GOLD" :
           isSubtitleActive ? "SUBTITLE" :
           isTikTokActive ? "TIKTOK" :
           isGamerActive ? "GAMER" :
           "PREVIEW"}
        </div>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @keyframes subtitleBounce {
            0%, 100% { transform: scale(1) translateY(0); }
            3% { transform: scale(0); opacity: 0; transform: translateY(25px); }
            5% { transform: scale(1.08) translateY(-5px) translateX(3px); opacity: 1; }
            7% { transform: scale(1.05) translateY(-3px) translateX(-2px); opacity: 1; }
            10% { transform: scale(1) translateY(0); }
          }
        `,
          }}
        />
      </div>
    </div>
  );
}
