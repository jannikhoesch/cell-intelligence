import { useState, useCallback, useEffect } from "react";
import { NetworkData, Drug, DrugSimilarity } from "@/types/drug";

const API_URL = "https://35d0242f8dc9.ngrok-free.app";

interface ApiState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  baseUrl: string;
}

// Headers required for ngrok to bypass browser warning
const ngrokHeaders = {
  "ngrok-skip-browser-warning": "true",
};

export function useApiConnection() {
  const [state, setState] = useState<ApiState>({
    isConnected: false,
    isLoading: true,
    error: null,
    baseUrl: API_URL,
  });

  // Test connection to the API
  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch(`${API_URL}/api/drugs`, {
        headers: ngrokHeaders,
      });
      if (!response.ok) throw new Error("Failed to connect to API");
      
      setState({ isConnected: true, isLoading: false, error: null, baseUrl: API_URL });
      return true;
    } catch (err) {
      setState({
        isConnected: false,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to connect",
        baseUrl: API_URL,
      });
      return false;
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Fetch network data
  const fetchNetworkData = useCallback(
    async (threshold: number): Promise<NetworkData> => {
      const response = await fetch(
        `${API_URL}/api/network?threshold=${threshold}`,
        { headers: ngrokHeaders }
      );
      if (!response.ok) throw new Error("Failed to fetch network data");
      return response.json();
    },
    []
  );

  // Fetch drugs list
  const fetchDrugs = useCallback(async (): Promise<Drug[]> => {
    const response = await fetch(`${API_URL}/api/drugs`, {
      headers: ngrokHeaders,
    });
    if (!response.ok) throw new Error("Failed to fetch drugs");
    return response.json();
  }, []);

  // Fetch single drug by ID
  const fetchDrug = useCallback(async (drugId: string): Promise<Drug | null> => {
    const response = await fetch(`${API_URL}/api/drugs/${drugId}`, {
      headers: ngrokHeaders,
    });
    if (!response.ok) return null;
    return response.json();
  }, []);

  // Fetch similar drugs for a given drug
  const fetchSimilarDrugs = useCallback(
    async (drugId: string, threshold: number): Promise<DrugSimilarity[]> => {
      const response = await fetch(
        `${API_URL}/api/similar/${drugId}?threshold=${threshold}`,
        { headers: ngrokHeaders }
      );
      if (!response.ok) throw new Error("Failed to fetch similarities");
      return response.json();
    },
    []
  );

  return {
    ...state,
    connect,
    fetchNetworkData,
    fetchDrugs,
    fetchDrug,
    fetchSimilarDrugs,
  };
}
