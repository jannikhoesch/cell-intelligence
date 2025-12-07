import { Slider } from "@/components/ui/slider";

interface SimilaritySliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function SimilaritySlider({ value, onChange }: SimilaritySliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          Similarity Threshold
        </label>
        <span className="text-sm font-mono text-primary">{value.toFixed(2)}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={1}
        step={0.05}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Low (0.0)</span>
        <span>High (1.0)</span>
      </div>
    </div>
  );
}
