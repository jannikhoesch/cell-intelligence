import { useState, useEffect } from "react";
import { NetworkGraph } from "@/components/NetworkGraph";
import { DrugSearch } from "@/components/DrugSearch";
import { SimilaritySlider } from "@/components/SimilaritySlider";
import { DrugDetailsPanel } from "@/components/DrugDetailsPanel";
import { StatsBar } from "@/components/StatsBar";
import { ChatBot } from "@/components/ChatBot";
import { useApiConnection } from "@/hooks/useApiConnection";
import { Drug, NetworkData, DrugSimilarity } from "@/types/drug";
import { Share2 } from "lucide-react";
import elixLogo from "@/assets/elix-logo.png";
const Index = () => {
  const [threshold, setThreshold] = useState(0.5);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [networkData, setNetworkData] = useState<NetworkData>({
    nodes: [],
    edges: []
  });
  const [similarDrugs, setSimilarDrugs] = useState<DrugSimilarity[]>([]);
  const [isLoadingNetwork, setIsLoadingNetwork] = useState(false);
  const api = useApiConnection();

  // Load drugs list and select 5-fluorouracil by default
  useEffect(() => {
    const loadDrugs = async () => {
      try {
        const data = await api.fetchDrugs();
        setDrugs(data);

        // Select 5-fluorouracil by default if none selected
        if (data.length > 0 && !selectedDrug) {
          const defaultDrug = data.find(d => d.drug.toLowerCase() === '5-fluorouracil') || data[0];
          setSelectedDrug(defaultDrug);
          setSelectedNodeId(defaultDrug.id);
        }
      } catch (err) {
        console.error("Failed to load drugs:", err);
      }
    };
    loadDrugs();
  }, [api.isConnected]);

  // Load network data when threshold changes or API connects
  useEffect(() => {
    const loadNetwork = async () => {
      setIsLoadingNetwork(true);
      try {
        const data = await api.fetchNetworkData(threshold);
        setNetworkData(data);
      } catch (err) {
        console.error("Failed to load network:", err);
      } finally {
        setIsLoadingNetwork(false);
      }
    };
    loadNetwork();
  }, [threshold, api.isConnected]);

  // Load similar drugs when selection or threshold changes
  useEffect(() => {
    const loadSimilar = async () => {
      if (!selectedDrug) {
        setSimilarDrugs([]);
        return;
      }
      try {
        const data = await api.fetchSimilarDrugs(selectedDrug.id, threshold);
        setSimilarDrugs(data);
      } catch (err) {
        console.error("Failed to load similar drugs:", err);
        setSimilarDrugs([]);
      }
    };
    loadSimilar();
  }, [selectedDrug, threshold, api.isConnected]);

  // Sync selected drug with node selection
  useEffect(() => {
    if (selectedNodeId) {
      const drug = drugs.find(d => d.id === selectedNodeId);
      if (drug) setSelectedDrug(drug);
    }
  }, [selectedNodeId, drugs]);
  useEffect(() => {
    if (selectedDrug) {
      setSelectedNodeId(selectedDrug.id);
    }
  }, [selectedDrug]);
  const handleSelectNode = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (!nodeId) setSelectedDrug(null);
  };
  const handleSelectSimilar = (drugId: string) => {
    const drug = drugs.find(d => d.id === drugId);
    if (drug) {
      setSelectedDrug(drug);
      setSelectedNodeId(drugId);
    }
  };
  return <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Main Dashboard */}
      <div className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col overflow-hidden">
        <div className="max-w-[1400px] mx-auto flex flex-col flex-1 min-h-0">
          {/* Header */}
          <header className="shrink-0 mb-4 animate-fade-in">
            <div className="flex items-center gap-4">
              {/* ELIX Logo */}
              <img alt="ELIX" className="h-12 md:h-16 w-auto" src="/lovable-uploads/f4b9e90f-f6e3-4cf7-9330-15500e042d0c.png" />
              <div className="hidden sm:block h-8 w-px bg-border/50" />
              <div className="hidden sm:block">
                <p className="text-sm text-muted-foreground max-w-xs">
                  Find drugs with similar cellular responses
                </p>
                <p className="text-xs text-muted-foreground/70">Target cell line: <span className="font-medium text-primary">A549</span> (human lung carcinoma)
                </p>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
            {/* Left Panel: Search + Drug Details */}
            <div className="flex flex-col gap-3 animate-fade-in-delay-2 min-h-0">
              {/* Search */}
              <div className="glass-panel rounded-xl p-4 space-y-4 shrink-0">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Query Drug
                </h3>
                <DrugSearch drugs={drugs} selectedDrug={selectedDrug} onSelectDrug={setSelectedDrug} />
              </div>

              {/* Drug Details */}
              <div className="animate-fade-in-delay-3 flex-1 min-h-0 overflow-auto">
                {selectedDrug ? <DrugDetailsPanel drug={selectedDrug} similarDrugs={similarDrugs} allDrugs={drugs} onSelectSimilar={handleSelectSimilar} /> : <div className="glass-panel rounded-xl p-4 text-center text-muted-foreground">
                    <p className="text-sm">Select a drug from the network to view details</p>
                  </div>}
              </div>
            </div>

            {/* Center Panel: Network Graph */}
            <div className="lg:col-span-2 animate-fade-in-delay-3 relative flex flex-col min-h-0">
              {isLoadingNetwork && <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 rounded-xl">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>}
              <NetworkGraph data={networkData} selectedNodeId={selectedNodeId} onSelectNode={handleSelectNode} className="flex-1 min-h-0" />
              <p className="text-xs text-muted-foreground text-center mt-2 shrink-0">
                Drug similarities computed via Tahoe-x1 embeddings
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Right Column - Threshold, Stats & Chatbot */}
      <div className="w-full md:w-1/4 md:min-w-[300px] md:max-w-[420px] md:h-full border-t md:border-t-0 md:border-l border-border/50 bg-card/30 flex flex-col overflow-hidden">
        {/* Top: Threshold Slider */}
        <div className="shrink-0 p-4 border-b border-border/50">
          <div className="glass-panel rounded-xl p-4">
            <SimilaritySlider value={threshold} onChange={setThreshold} />
          </div>
        </div>

        {/* Stats */}
        <div className="shrink-0 p-4 border-b border-border/50">
          <div className="glass-panel rounded-xl p-4">
            <StatsBar data={networkData} threshold={threshold} />
          </div>
        </div>
        
        {/* Bottom: Chatbot */}
        <div className="flex-1 p-4 min-h-0 overflow-hidden">
          <ChatBot selectedDrug={selectedDrug} similarDrugs={similarDrugs} allDrugs={drugs} threshold={threshold} />
        </div>
      </div>
    </div>;
};
export default Index;