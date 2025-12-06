import os
from dotenv import load_dotenv
from fastapi import FastAPI
from qdrant_client import QdrantClient

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# Qdrant Cloud configuration - both are required
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

# Validate that required environment variables are set
if not QDRANT_URL or not QDRANT_API_KEY:
    raise ValueError(
        "QDRANT_URL and QDRANT_API_KEY environment variables must be set. "
        "Get them from https://cloud.qdrant.io"
    )

# Initialize Qdrant Cloud client
qdrant = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY
)

COLLECTION = "drug_embeddings"  # Store delta embeddings here

# GET /api/network?threshold=0.5
@app.get("/api/network")
def get_network(threshold: float = 0.5):
    # Get all drugs, then query Qdrant for pairs above threshold
    # Each point: id=drug_id, vector=delta_embedding, payload={name, moa}
    
    all_points = qdrant.scroll(COLLECTION, limit=1000)[0]
    nodes = [{"id": p.id, **p.payload} for p in all_points]
    
    edges = []
    for point in all_points:
        similar = qdrant.search(
            COLLECTION, 
            query_vector=point.vector,
            score_threshold=threshold,
            limit=50
        )
        for hit in similar:
            if hit.id != point.id:
                edges.append({
                    "source": point.id, 
                    "target": hit.id, 
                    "similarity": hit.score
                })
    
    return {"nodes": nodes, "edges": edges}

# GET /api/similar/{drug_id}?threshold=0.5
@app.get("/api/similar/{drug_id}")
def get_similar(drug_id: str, threshold: float = 0.5):
    point = qdrant.retrieve(COLLECTION, ids=[drug_id])[0]
    results = qdrant.search(
        COLLECTION,
        query_vector=point.vector,
        score_threshold=threshold,
        limit=20
    )
    return [{"id": r.id, "similarity": r.score, **r.payload} for r in results]

