import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from qdrant_client import QdrantClient
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Drug Similarity API")

# CORS configuration
origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Qdrant client
qdrant = QdrantClient(
    url=os.getenv("QDRANT_URL"),
    api_key=os.getenv("QDRANT_API_KEY"),
)

COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "drug_embeddings")


# Pydantic models
class Drug(BaseModel):
    id: str
    drug: str
    cell_line: str
    samples_aggregated: int


class DrugSimilarity(BaseModel):
    drug: Drug
    similarity: float


class NetworkNode(BaseModel):
    id: str
    drug: str
    cell_line: str
    samples_aggregated: int
    x: Optional[float] = None
    y: Optional[float] = None


class NetworkLink(BaseModel):
    source: str
    target: str
    similarity: float


class NetworkData(BaseModel):
    nodes: List[NetworkNode]
    links: List[NetworkLink]


def point_to_drug(point) -> Drug:
    """Convert Qdrant point to Drug model"""
    payload = point.payload
    return Drug(
        id=str(point.id),
        drug=payload.get("drug", "Unknown"),
        cell_line=payload.get("cell_line", ""),
        samples_aggregated=payload.get("samples_aggregated", 0),
    )


@app.get("/api/drugs", response_model=List[Drug])
async def get_drugs(limit: int = Query(100, le=1000)):
    """Get all drugs from the database"""
    result = qdrant.scroll(
        collection_name=COLLECTION_NAME,
        limit=limit,
        with_payload=True,
        with_vectors=False,
    )
    points, _ = result
    return [point_to_drug(p) for p in points]


@app.get("/api/drugs/{drug_id}", response_model=Drug)
async def get_drug(drug_id: str):
    """Get a single drug by ID"""
    try:
        points = qdrant.retrieve(
            collection_name=COLLECTION_NAME,
            ids=[drug_id],
            with_payload=True,
        )
        if not points:
            raise HTTPException(status_code=404, detail="Drug not found")
        return point_to_drug(points[0])
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/similar/{drug_id}", response_model=List[DrugSimilarity])
async def get_similar_drugs(
    drug_id: str,
    threshold: float = Query(0.7, ge=0, le=1),
    limit: int = Query(20, le=100),
):
    """Find drugs similar to the given drug"""
    # Get the source drug's vector
    try:
        points = qdrant.retrieve(
            collection_name=COLLECTION_NAME,
            ids=[drug_id],
            with_vectors=True,
            with_payload=True,
        )
        if not points:
            raise HTTPException(status_code=404, detail="Drug not found")
        
        source_vector = points[0].vector
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Search for similar drugs
    results = qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=source_vector,
        limit=limit + 1,  # +1 to exclude self
        score_threshold=threshold,
        with_payload=True,
    )

    similarities = []
    for hit in results:
        if str(hit.id) != drug_id:  # Exclude self
            similarities.append(
                DrugSimilarity(
                    drug=point_to_drug(hit),
                    similarity=hit.score,
                )
            )

    return similarities[:limit]


@app.get("/api/network", response_model=NetworkData)
async def get_network(
    threshold: float = Query(0.7, ge=0, le=1),
    limit: int = Query(50, le=200),
):
    """Get network graph data with similarity links above threshold"""
    # Get all drugs
    result = qdrant.scroll(
        collection_name=COLLECTION_NAME,
        limit=limit,
        with_payload=True,
        with_vectors=True,
    )
    points, _ = result

    nodes = []
    links = []
    processed_pairs = set()

    # Create nodes
    for point in points:
        nodes.append(
            NetworkNode(
                id=str(point.id),
                drug=point.payload.get("drug", "Unknown"),
                cell_line=point.payload.get("cell_line", ""),
                samples_aggregated=point.payload.get("samples_aggregated", 0),
            )
        )

    # Find similarities between all pairs
    for i, point in enumerate(points):
        results = qdrant.search(
            collection_name=COLLECTION_NAME,
            query_vector=point.vector,
            limit=limit,
            score_threshold=threshold,
            with_payload=True,
        )

        for hit in results:
            source_id = str(point.id)
            target_id = str(hit.id)

            if source_id == target_id:
                continue

            # Avoid duplicate links
            pair_key = tuple(sorted([source_id, target_id]))
            if pair_key in processed_pairs:
                continue
            processed_pairs.add(pair_key)

            links.append(
                NetworkLink(
                    source=source_id,
                    target=target_id,
                    similarity=hit.score,
                )
            )

    return NetworkData(nodes=nodes, links=links)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
