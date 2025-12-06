from datasets import load_dataset
from itertools import islice
from qdrant_client.models import VectorParams, Distance, PointStruct
from config import client
import datasets
import os

datasets.config.DEFAULT_STREAMING_READ_IMPLEMENTATION = "python"

# STREAMING MODE
dataset = load_dataset(
    "tahoebio/Tahoe-x1-embeddings",
    split="train",
    streaming=True
)

# Get embedding dimension
first_row = next(iter(dataset))
vector_dim = len(first_row["mosaicfm-3b-prod-cont-MFMv2"])
print("Embedding dim:", vector_dim)

# Create Qdrant collection
collection_name = "tahoe_filtered_qdrant"

client.recreate_collection(
    collection_name=collection_name,
    vectors_config=VectorParams(
        size=vector_dim,
        distance=Distance.COSINE
    )
)

# Restart dataset iterator
dataset = load_dataset(
    "tahoebio/Tahoe-x1-embeddings",
    split="train",
    streaming=True
)
iterator = iter(dataset)

uploaded = 0
numeric_id = 0   # ← numeric ID counter

for row in iterator:
    if uploaded >= 100:
        break

    # FILTER for CVCL_0023 only
    if row["cell_line"] != "CVCL_0023":
        continue

    embedding = row["mosaicfm-3b-prod-cont-MFMv2"]
    barcode = row["BARCODE_SUB_LIB_ID"]
    cell_line = row["cell_line"]

    point = PointStruct(
        id=numeric_id,     # ← numeric ID
        vector=embedding,
        payload={
            "barcode": barcode,
            "cell_line": cell_line
        }
    )

    client.upsert(
        collection_name=collection_name,
        points=[point]
    )

    numeric_id += 1  # increment for next point
    uploaded += 1

print(f"Uploaded {uploaded} rows using numeric IDs.")

os._exit(0)  # prevents PyArrow cleanup crash
