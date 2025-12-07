"""Pydantic models for the API."""
from typing import List, Optional
from pydantic import BaseModel


class Drug(BaseModel):
    """Drug treatment signature model."""
    id: str
    drug: str
    cell_line: str
    samples_aggregated: int


class DrugSimilarity(BaseModel):
    """Drug similarity result model."""
    drugId: str
    similarity: float


class NetworkNode(BaseModel):
    """Network graph node model."""
    id: str
    drug: str
    cell_line: str
    samples_aggregated: int
    x: Optional[float] = None
    y: Optional[float] = None


class NetworkLink(BaseModel):
    """Network graph link/edge model."""
    source: str
    target: str
    similarity: float


class NetworkData(BaseModel):
    """Network graph data model."""
    nodes: List[NetworkNode]
    edges: List[NetworkLink]

