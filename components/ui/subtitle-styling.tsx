import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  animated: boolean;
  dropShadowIntensity: number;
}

interface SubtitleStylingProps {
  style: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
  className?: string;
}

const fontOptions = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Courier New, monospace", label: "Courier" },
];

const fontSizeOptions = [
  { value: 16, label: "Small" },
  { value: 20, label: "Medium" },
  { value: 24, label: "Large" },
  { value: 42, label: "X Large" },
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

  const handleAnimationToggle = (checked: boolean) => {
    onChange({ ...style, animated: checked });
  };

  const handleDropShadowIntensityChange = (value: string) => {
    onChange({ ...style, dropShadowIntensity: Number(value) });
  };

  // Add preset styles
  const applyMetallicStyle = () => {
    onChange({
      ...style,
      fontFamily: "Arial, sans-serif",
      fontSize: 42,
      fontWeight: "900",
      color: "#CCCCCC",
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: "#000000",
      animated: true,
      dropShadowIntensity: 0.9,
    });
  };

  // Add bright green with black border preset
  const applyGreenStyle = () => {
    onChange({
      ...style,
      fontFamily: "Arial, sans-serif",
      fontSize: 42,
      fontWeight: "900",
      color: "#00FF00", // Bright green
      backgroundColor: "transparent",
      borderWidth: 3,
      borderColor: "#000000", // Black border
      animated: true,
      dropShadowIntensity: 0.8,
    });
  };

  // Add yellow text on black background preset
  const applyYellowOnBlackStyle = () => {
    onChange({
      ...style,
      fontFamily: "Arial, sans-serif",
      fontSize: 42,
      fontWeight: "900",
      color: "#FFFF00", // Bright yellow
      backgroundColor: "#000000", // Black background
      borderWidth: 0,
      borderColor: "#000000",
      animated: true,
      dropShadowIntensity: 0.5,
    });
  };

  // Add black text on yellow background preset with normal font size
  const applyBlackOnYellowStyle = () => {
    onChange({
      ...style,
      fontFamily: "Arial, sans-serif",
      fontSize: 20, // Normal font size
      fontWeight: "bold",
      color: "#000000", // Black text
      backgroundColor: "#FFFF00", // Yellow background
      borderWidth: 0,
      borderColor: "#000000",
      animated: true,
      dropShadowIntensity: 0.3,
    });
  };

  // Check if current style matches a preset
  const isMetallicActive =
    style.fontFamily === "Arial, sans-serif" &&
    style.fontSize === 42 &&
    style.fontWeight === "900" &&
    style.color === "#CCCCCC" &&
    style.backgroundColor === "transparent" &&
    style.borderWidth === 2 &&
    style.borderColor === "#000000";

  const isGreenActive =
    style.fontFamily === "Arial, sans-serif" &&
    style.fontSize === 42 &&
    style.fontWeight === "900" &&
    style.color === "#00FF00" &&
    style.backgroundColor === "transparent" &&
    style.borderWidth === 3 &&
    style.borderColor === "#000000";

  const isYellowOnBlackActive =
    style.fontFamily === "Arial, sans-serif" &&
    style.fontSize === 42 &&
    style.fontWeight === "900" &&
    style.color === "#FFFF00" &&
    style.backgroundColor === "#000000" &&
    style.borderWidth === 0;

  const isBlackOnYellowActive =
    style.fontFamily === "Arial, sans-serif" &&
    style.fontSize === 20 &&
    style.fontWeight === "bold" &&
    style.color === "#000000" &&
    style.backgroundColor === "#FFFF00" &&
    style.borderWidth === 0;

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      <div className="px-4 mb-2">
        <h3 className="font-medium text-lg">Subtitle Styling</h3>
      </div>

      <div className="p-2 space-y-3 flex-1 overflow-y-auto">
        {/* Presets */}
        <div className="space-y-2 mb-2">
          <label className="text-sm font-medium block">Presets</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={applyMetallicStyle}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-colors w-full ${
                isMetallicActive ? "ring-2 ring-primary" : ""
              }`}
              style={{
                background:
                  "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0px 1px 2px rgba(0, 0, 0, 0.5)",
              }}
            >
              IMPORTANT
            </button>
            <button
              onClick={applyGreenStyle}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-colors w-full ${
                isGreenActive ? "ring-2 ring-primary" : ""
              }`}
              style={{
                color: "#00FF00",
                backgroundColor: "transparent",
                textShadow: "0px 0px 3px #000000, 0px 0px 2px #000000",
              }}
            >
              GREEN
            </button>
            <button
              onClick={applyYellowOnBlackStyle}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-colors w-full ${
                isYellowOnBlackActive ? "ring-2 ring-primary" : ""
              }`}
              style={{
                color: "#FFFF00",
                backgroundColor: "#000000",
                padding: "6px",
              }}
            >
              YELLOW
            </button>
            <button
              onClick={applyBlackOnYellowStyle}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-colors w-full ${
                isBlackOnYellowActive ? "ring-2 ring-primary" : ""
              }`}
              style={{
                color: "#000000",
                backgroundColor: "#FFFF00",
                padding: "6px",
                fontSize: "14px",
              }}
            >
              SUBTITLE
            </button>
          </div>
        </div>

        {/* Add animation toggle switch after the presets */}
        <div className="space-y-2 pt-1 pb-1 border-t border-b">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="animated-toggle"
              className="text-sm font-medium cursor-pointer"
            >
              Animated Entrance
            </Label>
            <Switch
              id="animated-toggle"
              checked={style.animated}
              onCheckedChange={handleAnimationToggle}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Subtitles will grow with a bounce effect when they appear
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Font Family</label>
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
            backgroundColor: style.backgroundColor,
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
            animation: style.animated ? "subtitleBounce 2s infinite" : "none",
          }}
        >
          IMPORTANT
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
