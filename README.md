# 🧬 Elix

**[🚀 Live Demo](https://preview--drug-effect-explorer.lovable.app)** | Built for Norrsken Fixathon 2025

## Overview

Elix is an AI engine that discovers new therapeutic uses for existing drugs by analyzing **phenotypic effects** rather than chemical structure. Traditional drug discovery misses connections between compounds that look different but behave similarly. Elix changes this by mapping how drugs actually alter cellular states, turning biology into a navigable geometric space.

## How It Works

Elix operates on the principle that drugs with similar cellular effects are mathematically close in high-dimensional space.

1. **Data Ingestion**: Processes the Tahoe-100M dataset (A549 Lung Cancer subset), aggregating single-cell transcriptomic embeddings across multiple samples per drug

2. **Delta Vector Calculation**: Computes the precise biological signal by subtracting the global DMSO baseline:
   ```
   V_delta = V_drug_aggregate - V_Global_DMSO_Baseline
   ```
   This cancels experimental noise, isolating pure drug effects.

3. **Vector Search**: Stores drug signatures in Qdrant Cloud for fast cosine-similarity search in latent space

4. **Interactive Exploration**: Researchers can query drugs, visualize phenotypic neighbors in a network graph, and get AI-powered biological explanations

## Architecture

```
Data Pipeline (Python) → Qdrant Cloud → FastAPI Backend → React Frontend
```

- **Backend**: FastAPI serving drug data and similarity queries
- **Frontend**: React + TypeScript with interactive D3.js network visualization
- **Vector DB**: Qdrant Cloud for high-performance similarity search
- **AI Copilot**: Integrated LLM with PubChem integration for biological insights

## Preview

<img width="1470" height="830" alt="image" src="https://github.com/user-attachments/assets/b923695f-8c6d-4b57-a36b-98691e200702" />
