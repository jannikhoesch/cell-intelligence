import { NetworkData } from "@/types/drug";
import { Database, GitBranch, Activity, Zap } from "lucide-react";

interface StatsBarProps {
  data: NetworkData;
  threshold: number;
}

export function StatsBar({ data, threshold }: StatsBarProps) {
  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];

  const stats = [
    {
      icon: Database,
      label: "Drugs",
      value: nodes.length,
    },
    {
      icon: GitBranch,
      label: "Connections",
      value: edges.length,
    },
    {
      icon: Activity,
      label: "Threshold",
      value: `≥${(threshold * 100).toFixed(0)}%`,
    },
    {
      icon: Zap,
      label: "Avg Similarity",
      value: edges.length > 0
        ? `${((edges.reduce((s, e) => s + e.similarity, 0) / edges.length) * 100).toFixed(0)}%`
        : "N/A",
    },
  ];

  return (
    <div className="flex items-center gap-6 flex-wrap">
      {stats.map((stat, i) => (
        <div key={i} className="flex items-center gap-2">
          <stat.icon className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">{stat.label}:</span>
          <span className="text-sm font-mono font-medium text-foreground">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
