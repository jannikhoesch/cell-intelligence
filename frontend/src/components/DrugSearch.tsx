import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Drug } from "@/types/drug";
import { cn } from "@/lib/utils";

interface DrugSearchProps {
  drugs: Drug[];
  selectedDrug: Drug | null;
  onSelectDrug: (drug: Drug | null) => void;
}

export function DrugSearch({ drugs, selectedDrug, onSelectDrug }: DrugSearchProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const filteredDrugs = useMemo(() => {
    if (!query.trim()) return drugs;
    const lowerQuery = query.toLowerCase();
    return drugs.filter(
      (drug) =>
        drug.drug.toLowerCase().includes(lowerQuery) ||
        drug.mechanism?.toLowerCase().includes(lowerQuery)
    );
  }, [drugs, query]);

  const handleSelect = (drug: Drug) => {
    onSelectDrug(drug);
    setQuery("");
    setIsFocused(false);
  };

  const handleClear = () => {
    onSelectDrug(null);
    setQuery("");
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search drugs by name or mechanism..."
          value={selectedDrug ? selectedDrug.drug : query}
          onChange={(e) => {
            if (selectedDrug) {
              onSelectDrug(null);
            }
            setQuery(e.target.value);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          className="pl-10 pr-10 bg-card/50 border-border/50 focus:border-primary/50"
        />
        {(selectedDrug || query) && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isFocused && !selectedDrug && filteredDrugs.length > 0 && (
        <div className="absolute z-50 w-full mt-2 py-2 glass-panel rounded-lg max-h-64 overflow-auto">
          {filteredDrugs.map((drug) => (
            <button
              key={drug.id}
              onClick={() => handleSelect(drug)}
              className={cn(
                "w-full px-4 py-2 text-left hover:bg-primary/10 transition-colors",
                "flex flex-col gap-0.5"
              )}
            >
              <span className="font-medium text-foreground">{drug.drug}</span>
              {drug.mechanism && (
                <span className="text-xs text-muted-foreground">{drug.mechanism}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {isFocused && !selectedDrug && query && filteredDrugs.length === 0 && (
        <div className="absolute z-50 w-full mt-2 py-4 glass-panel rounded-lg text-center text-muted-foreground">
          No drugs found matching "{query}"
        </div>
      )}
    </div>
  );
}
