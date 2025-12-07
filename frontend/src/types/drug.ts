export interface Drug {
  id: string;
  drug: string;  // drug name from Qdrant
  cell_line: string;  // single cell line (e.g., "CVCL_0023")
  samples_aggregated?: number;
  mechanism?: string;  // optional, may come from external source
}

export interface DrugSimilarity {
  drugId: string;
  similarity: number;
}

export interface NetworkNode {
  id: string;
  drug: string;  // drug name
  cell_line: string;
  x?: number;
  y?: number;
  size?: number;
  mechanism?: string;
}

export interface NetworkEdge {
  source: string;
  target: string;
  similarity: number;
}

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface ApiConfig {
  baseUrl: string;
  endpoints: {
    drugs: string;
    similarities: string;
    network: string;
  };
}
