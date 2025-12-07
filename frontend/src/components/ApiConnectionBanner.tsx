import { useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ApiConnectionBannerProps {
  isConnected: boolean;
  onConnect: () => Promise<boolean>;
}

export function ApiConnectionBanner({ isConnected, onConnect }: ApiConnectionBannerProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleRetry = async () => {
    setIsConnecting(true);
    await onConnect();
    setIsConnecting(false);
  };

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm transition-colors",
        isConnected
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-destructive/30 bg-destructive/5 text-destructive"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Cloud className="h-4 w-4" />
          ) : (
            <CloudOff className="h-4 w-4" />
          )}
          <span>
            {isConnected
              ? "Connected to API"
              : "Failed to connect to API"}
          </span>
        </div>
        {!isConnected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            disabled={isConnecting}
            className="h-8 px-2 gap-1"
          >
            <RefreshCw className={cn("h-4 w-4", isConnecting && "animate-spin")} />
            {isConnecting ? "Retrying..." : "Retry"}
          </Button>
        )}
      </div>
    </div>
  );
}
