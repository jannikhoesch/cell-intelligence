import os
from typing import List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from qdrant_client import QdrantClient
from dotenv import load_dotenv

from models import Drug, DrugSimilarity, NetworkNode, NetworkLink, NetworkData

load_dotenv()

app = FastAPI(
    title="Drug Similarity API",
    description="API for querying drug treatment signatures on cell lines. Each vector represents a treated cell under a specific drug on a specific cell line."
)

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

COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "tahoe_drug_signatures-jannik")


def point_to_drug(point) -> Drug:
    """Convert Qdrant point to Drug model.
    
    Each point represents a drug treatment signature on a specific cell line.
    The vector encodes the cellular response to that drug treatment.
    """
    payload = point.payload
    return Drug(
        id=str(point.id),
        drug=payload.get("drug", "Unknown"),
        cell_line=payload.get("cell_line", ""),
        samples_aggregated=payload.get("samples_aggregated", 0),
    )


@app.get("/api/drugs", response_model=List[Drug])
async def get_drugs(limit: int = Query(100, le=1000)):
    """Get all drug treatment signatures from the database.
    
    Returns up to 94 vectors, each representing a drug treatment on a specific cell line.
    """
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
    """Get a single drug treatment signature by ID.
    
    Returns the drug, cell line, and aggregated sample count for a specific treatment.
    """
    try:
        # Convert string ID to int (IDs are hash integers)
        drug_id_int = int(drug_id)
        points = qdrant.retrieve(
            collection_name=COLLECTION_NAME,
            ids=[drug_id_int],
            with_payload=True,
        )
        if not points:
            raise HTTPException(status_code=404, detail="Drug not found")
        return point_to_drug(points[0])
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid drug_id: {drug_id}. Must be an integer.")
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/similar/{drug_id}", response_model=List[DrugSimilarity])
async def get_similar_drugs(
    drug_id: str,
    threshold: float = Query(0.7, ge=0, le=1),
    limit: int = Query(20, le=100),
):
    """Find drug treatments with similar cellular response signatures.
    
    Given a drug treatment (drug + cell line combination), finds other treatments
    that produce similar cellular responses based on vector similarity.
    """
    # Get the source drug's vector
    try:
        # Convert string ID to int (IDs are hash integers)
        drug_id_int = int(drug_id)
        points = qdrant.retrieve(
            collection_name=COLLECTION_NAME,
            ids=[drug_id_int],
            with_vectors=True,
            with_payload=True,
        )
        if not points:
            raise HTTPException(status_code=404, detail="Drug not found")
        
        source_vector = points[0].vector
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid drug_id: {drug_id}. Must be an integer.")
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Search for similar drugs
    query_response = qdrant.query_points(
        collection_name=COLLECTION_NAME,
        query=source_vector,
        limit=limit + 1,  # +1 to exclude self
        score_threshold=threshold,
        with_payload=True,
    )

    similarities = []
    for hit in query_response.points:
        if hit.id != drug_id_int:  # Exclude self
            similarities.append(
                DrugSimilarity(
                    drugId=str(hit.id),
                    similarity=hit.score,
                )
            )

    return similarities[:limit]


@app.get("/api/network", response_model=NetworkData)
async def get_network(
    threshold: float = Query(0.7, ge=0, le=1),
    limit: int = Query(50, le=200),
):
    """Get network graph data with similarity links above threshold.
    
    Creates a network where nodes are drug treatments (drug + cell line) and edges
    connect treatments with similar cellular response signatures above the threshold.
    """
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
    for point in points:
        query_response = qdrant.query_points(
            collection_name=COLLECTION_NAME,
            query=point.vector,
            limit=limit,
            score_threshold=threshold,
            with_payload=True,
        )

        for hit in query_response.points:
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

    return NetworkData(nodes=nodes, edges=links)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
