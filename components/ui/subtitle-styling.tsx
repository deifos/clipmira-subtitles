export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
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
  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...style, fontFamily: e.target.value });
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...style, fontSize: Number(e.target.value) });
  };

  const handleFontWeightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...style, fontWeight: e.target.value });
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...style, color: e.target.value });
  };

  const handleBackgroundColorChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({ ...style, backgroundColor: e.target.value });
  };

  const handleBorderWidthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...style, borderWidth: Number(e.target.value) });
  };

  const handleBorderColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...style, borderColor: e.target.value });
  };

  return (
    <div
      className={`flex flex-col h-full border rounded-lg overflow-hidden ${className}`}
    >
      <div className="p-4 border-b">
        <h3 className="font-medium text-lg">Subtitle Styling</h3>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <div className="space-y-2">
          <label className="text-sm font-medium block">Font Family</label>
          <select
            value={style.fontFamily}
            onChange={handleFontFamilyChange}
            className="w-full p-2 border rounded-md bg-background"
          >
            {fontOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Font Size</label>
          <select
            value={style.fontSize}
            onChange={handleFontSizeChange}
            className="w-full p-2 border rounded-md bg-background"
          >
            {fontSizeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Font Weight</label>
          <select
            value={style.fontWeight}
            onChange={handleFontWeightChange}
            className="w-full p-2 border rounded-md bg-background"
          >
            {fontWeightOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
          <select
            value={style.borderWidth}
            onChange={handleBorderWidthChange}
            className="w-full p-2 border rounded-md bg-background"
          >
            {borderWidthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
      </div>

      <div className="p-4 border-t">
        <div
          className="p-3 rounded-md text-center"
          style={{
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            letterSpacing: style.borderWidth > 2 ? "0.5px" : "normal",
            color: style.color,
            backgroundColor: style.backgroundColor,
            textShadow:
              style.borderWidth > 0
                ? `-1px -1px 0 ${style.borderColor}, 1px -1px 0 ${style.borderColor}, -1px 1px 0 ${style.borderColor}, 1px 1px 0 ${style.borderColor}`
                : "none",
            WebkitTextStroke:
              style.borderWidth > 0
                ? `${style.borderWidth}px ${style.borderColor}`
                : "none",
          }}
        >
          Preview Text
        </div>
      </div>
    </div>
  );
}
