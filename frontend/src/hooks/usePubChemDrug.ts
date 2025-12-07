import { useState, useEffect } from "react";

interface PubChemDrugInfo {
  description: string;
  pubchemUrl: string;
  isLoading: boolean;
  error: string | null;
}

export function usePubChemDrug(drugName: string): PubChemDrugInfo {
  const [description, setDescription] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pubchemUrl = `https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(drugName)}`;

  useEffect(() => {
    if (!drugName) {
      setDescription("");
      return;
    }

    const fetchDrugInfo = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // First, get the CID (Compound ID) from the drug name
        const searchResponse = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(drugName)}/cids/JSON`
        );

        if (!searchResponse.ok) {
          throw new Error("Drug not found in PubChem");
        }

        const searchData = await searchResponse.json();
        const cid = searchData.IdentifierList?.CID?.[0];

        if (!cid) {
          throw new Error("No compound ID found");
        }

        // Fetch the description using the CID
        const descResponse = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/description/JSON`
        );

        if (descResponse.ok) {
          const descData = await descResponse.json();
          const descriptions = descData.InformationList?.Information;
          
          // Get the first meaningful description
          const mainDesc = descriptions?.find(
            (info: any) => info.Description && info.Description.length > 50
          );
          
          if (mainDesc?.Description) {
            // Truncate to first 2-3 sentences for readability
            const sentences = mainDesc.Description.split(". ");
            const shortDesc = sentences.slice(0, 3).join(". ");
            setDescription(shortDesc + (sentences.length > 3 ? "..." : "."));
          } else {
            setDescription("No detailed description available.");
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch drug info");
        setDescription("");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrugInfo();
  }, [drugName]);

  return { description, pubchemUrl, isLoading, error };
}
