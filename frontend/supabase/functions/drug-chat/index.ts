import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Sending request to Lovable AI Gateway with messages:", messages.length);
    console.log("Context provided:", context ? JSON.stringify(context) : "none");

    // Build context-aware system prompt
    let systemPrompt = `You are Elix, a drug repurposing research assistant. Be VERY CONCISE - aim for 2-3 sentences max unless asked for details.

You help with:
- Drug similarity networks and interpreting connections
- Mechanisms of action (MoA)
- Tahoe-x1 embeddings and cosine similarity scores
- Drug repurposing concepts and research`;

    // Add current dashboard context if available
    if (context?.selectedDrug) {
      systemPrompt += `

CURRENT CONTEXT - The user is viewing:
- Selected Drug: ${context.selectedDrug.drug} (ID: ${context.selectedDrug.id})
- Mechanism: ${context.selectedDrug.mechanism || "Unknown"}
- Cell Line: ${context.selectedDrug.cell_line || "Unknown"}
- Samples Aggregated: ${context.selectedDrug.samples_aggregated || "Unknown"}`;
      
      if (context.similarDrugs && context.similarDrugs.length > 0) {
        systemPrompt += `
- Similar Drugs Found: ${context.similarDrugs.length}
- Top Similar: ${context.similarDrugs.slice(0, 3).map((d: any) => `${d.drugName || d.drugId} (${(d.similarity * 100).toFixed(0)}%)`).join(", ")}`;
      }
      
      if (context.threshold) {
        systemPrompt += `
- Current Similarity Threshold: ${(context.threshold * 100).toFixed(0)}%`;
      }
    }

    systemPrompt += `

Use this context to give relevant, personalized answers about what the user is currently exploring. Short, direct answers unless more detail is requested.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const errorText = await response.text();
      console.error("Error response:", errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response from AI gateway");
    
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
