from datasets import load_dataset
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
from config import client  # Assuming you have your credentials here
import datasets
import numpy as np
from collections import defaultdict
import os

# OPTIMIZATION: Use Python implementation for streaming if PyArrow causes issues
datasets.config.DEFAULT_STREAMING_READ_IMPLEMENTATION = "python"

# --- CONFIGURATION ---
COLLECTION_NAME = "tahoe_drug_signatures-jannik"
TARGET_CELL_LINE = "CVCL_0023"  # CVCL_0023 is the ID for A549 (Lung Cancer)
CONTROL_DRUG = "DMSO_TF"        # The baseline solvent
BATCH_ID_COL = "sample"  # The column representing independent experiments (groups drugs with their DMSO control)

print("Initializing Stream...")

# 1. LOAD DATASET (STREAMING)
dataset = load_dataset(
    "tahoebio/Tahoe-x1-embeddings",
    split="train",
    streaming=True
)

# 2. CREATE FILTERED ITERATOR - Only CVCL_0023 samples
print(f"Filtering dataset for cell line: {TARGET_CELL_LINE}...")

def filtered_iterator(dataset_iter, target_cell_line):
    """Generator that only yields rows matching the target cell line"""
    skipped = 0
    for row in dataset_iter:
        if row["cell_line"] == target_cell_line:
            yield row
        else:
            skipped += 1
            if skipped % 10000 == 0:
                print(f"  Skipped {skipped} non-matching rows...")

# Create filtered iterator
raw_iterator = iter(dataset)
filtered_iter = filtered_iterator(raw_iterator, TARGET_CELL_LINE)

# Vector dimension is fixed
vector_dim = 2560
print(f"Embedding dim: {vector_dim}")

# 3. SETUP QDRANT
client.recreate_collection(
    collection_name=COLLECTION_NAME,
    vectors_config=VectorParams(size=vector_dim, distance=Distance.COSINE)
)

# 4. INITIALIZE ACCUMULATORS
# Structure: batch_accumulators[batch_id][drug_name] = {'sum': vector, 'count': int}
batch_accumulators = defaultdict(lambda: defaultdict(lambda: {'sum': np.zeros(vector_dim), 'count': 0}))

# Process rows
processed_rows = 0
limit_rows = 1000  # Set high enough to capture full batches (or remove for production)

print(f"Streaming and aggregating rows (Limit: {limit_rows})...")

# 5. STREAM & AGGREGATE (The 'Map' Phase)
# All rows from filtered_iter are already CVCL_0023, so no need to check again
for row in filtered_iter:
    if processed_rows >= limit_rows:
        print(f"Limit of {limit_rows} reached. Stopping stream.")
        break

    # Extract Data
    batch_id = row[BATCH_ID_COL]
    drug = row["drug"]
    vector = np.array(row["mosaicfm-3b-prod-cont-MFMv2"], dtype=np.float32)

    # Accumulate
    acc = batch_accumulators[batch_id][drug]
    acc['sum'] += vector
    acc['count'] += 1

    processed_rows += 1
    if processed_rows % 100 == 0:
        print(f"Processed {processed_rows} rows...")

# 6. COMPUTE DELTAS (The 'Reduce' Phase)
print("Computing Sample-Normalized Deltas...")

final_drug_deltas = defaultdict(list)
skipped_batches = 0

for batch_id, drugs_data in batch_accumulators.items():
    
    # Check A: Does this batch have the Control (DMSO)?
    if CONTROL_DRUG not in drugs_data:
        skipped_batches += 1
        continue # Cannot normalize this batch
        
    # Check B: Calculate Local Baseline Vector
    dmso_stats = drugs_data[CONTROL_DRUG]
    local_baseline = dmso_stats['sum'] / dmso_stats['count']
    
    # Check C: Calculate Deltas for all other drugs in this batch
    for drug, stats in drugs_data.items():
        if drug == CONTROL_DRUG:
            continue
            
        drug_mean = stats['sum'] / stats['count']
        
        # KEY STEP: Vector Subtraction
        # "Drug Effect" = "Drug State" - "Baseline State"
        delta = drug_mean - local_baseline
        
        final_drug_deltas[drug].append(delta)

print(f"Aggregation Complete. Skipped {skipped_batches} batches (missing DMSO).")

# 7. UPLOAD TO QDRANT
print(f"Uploading signatures for {len(final_drug_deltas)} unique drugs...")

points_to_upload = []

for drug, delta_list in final_drug_deltas.items():
    # Average the deltas from all valid batches
    global_delta = np.mean(np.stack(delta_list), axis=0)
    
    # Create deterministic ID based on Drug Name
    # (Using string hashing so we don't need a counter)
    point_id = abs(hash(f"{TARGET_CELL_LINE}_{drug}"))
    
    points_to_upload.append(PointStruct(
        id=point_id,
        vector=global_delta.tolist(),
        payload={
            "drug": drug,
            "cell_line": TARGET_CELL_LINE,
            "cell_line_id": "CVCL_0023",
            "batches_aggregated": len(delta_list),
            "type": "drug_signature_delta"
        }
    ))

if points_to_upload:
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points_to_upload
    )
    print(f"SUCCESS: Uploaded {len(points_to_upload)} vectors to '{COLLECTION_NAME}'.")
else:
    print("WARNING: No vectors to upload. (Did you process enough rows to find matching DMSO controls?)")

os._exit(0)