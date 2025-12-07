import { Drug, DrugSimilarity } from "@/types/drug";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowRight, Dna, FlaskConical, Microscope, ExternalLink, Loader2 } from "lucide-react";
import { usePubChemDrug } from "@/hooks/usePubChemDrug";

interface DrugDetailsPanelProps {
  drug: Drug;
  similarDrugs: DrugSimilarity[];
  allDrugs: Drug[];
  onSelectSimilar: (drugId: string) => void;
}

export function DrugDetailsPanel({
  drug,
  similarDrugs,
  allDrugs,
  onSelectSimilar,
}: DrugDetailsPanelProps) {
  const { description, pubchemUrl, isLoading, error } = usePubChemDrug(drug.drug);

  const getDrugById = (id: string) => allDrugs.find(d => d.id === id);

  return (
    <div className="glass-panel rounded-xl p-5 space-y-5 animate-fade-in">
      {/* Drug Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-semibold text-gradient-primary">{drug.drug}</h2>
          <Badge variant="secondary" className="font-mono text-xs">
            {drug.id}
          </Badge>
        </div>

        {/* Drug Description from PubChem */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading drug information...</span>
            </div>
          ) : description ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          ) : error ? (
            <p className="text-sm text-muted-foreground italic">
              Could not load description from PubChem.
            </p>
          ) : null}
          
          {/* PubChem Link */}
          <a
            href={pubchemUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View on PubChem
          </a>
        </div>

        {/* Mechanism of Action */}
        {drug.mechanism && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Mechanism of Action (MoA)
            </span>
            <div className="flex items-center gap-2 text-sm">
              <FlaskConical className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-foreground">{drug.mechanism}</span>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              How this drug works at the molecular level
            </p>
          </div>
        )}

        {/* Cell Line Used for Testing */}
        {drug.cell_line && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Cell Line Tested
            </span>
            <div className="flex items-center gap-2">
              <Microscope className="h-4 w-4 text-primary flex-shrink-0" />
              <Badge variant="outline" className="text-xs">
                {drug.cell_line}
              </Badge>
              {drug.samples_aggregated && (
                <span className="text-xs text-muted-foreground">
                  ({drug.samples_aggregated} samples)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              Human cell line used to measure this drug's effects
            </p>
          </div>
        )}
      </div>

      {/* Similar Drugs */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Dna className="h-4 w-4" />
          Similar Cellular Response ({similarDrugs.length})
        </h3>

        {similarDrugs.length > 0 ? (
          <div className="space-y-2">
            {similarDrugs.map(({ drugId, similarity }) => {
              const similarDrug = getDrugById(drugId);
              if (!similarDrug) return null;

              return (
                <button
                  key={drugId}
                  onClick={() => onSelectSimilar(drugId)}
                  className={cn(
                    "w-full p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50",
                    "flex items-center justify-between gap-3 group transition-all",
                    "border border-transparent hover:border-primary/30"
                  )}
                >
                  <div className="flex-1 text-left">
                    <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {similarDrug.drug}
                    </div>
                    {similarDrug.mechanism && (
                      <div className="text-xs text-muted-foreground truncate">
                        {similarDrug.mechanism}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <SimilarityBar value={similarity} />
                    <span className="font-mono text-sm text-primary">
                      {(similarity * 100).toFixed(0)}%
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No similar drugs found at current threshold
          </div>
        )}
      </div>
    </div>
  );
}

function SimilarityBar({ value }: { value: number }) {
  return (
    <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-500"
        style={{ width: `${value * 100}%` }}
      />
    </div>
  );
}
