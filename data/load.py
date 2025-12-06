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
# Structure: drug_accumulators[drug_name] = {'sum': vector, 'count': int}
# We accumulate all vectors for each drug globally, disregarding batches
drug_accumulators = defaultdict(lambda: {'sum': np.zeros(vector_dim), 'count': 0})

# Process rows
processed_rows = 0

print("Streaming and aggregating all rows...")

# 5. STREAM & AGGREGATE (Global aggregation, disregarding batches)
# All rows from filtered_iter are already CVCL_0023, so no need to check again
for row in filtered_iter:
    # Extract Data
    drug = row["drug"]
    vector = np.array(row["mosaicfm-3b-prod-cont-MFMv2"], dtype=np.float32)

    # Print when DMSO is found
    if drug == CONTROL_DRUG:
        print(f"Found DMSO at row {processed_rows + 1}")

    # Accumulate globally (disregarding batches)
    acc = drug_accumulators[drug]
    acc['sum'] += vector
    acc['count'] += 1

    processed_rows += 1
    if processed_rows % 100 == 0:
        print(f"Processed {processed_rows} rows...")

# 6. COMPUTE GLOBAL BASELINE AND DELTAS
print("Computing Global DMSO Baseline and Drug Deltas...")

# Check if we have DMSO control data
if CONTROL_DRUG not in drug_accumulators:
    print(f"ERROR: No {CONTROL_DRUG} control found. Cannot compute deltas.")
    os._exit(1)

# Compute global DMSO baseline (average over all DMSO states)
dmso_stats = drug_accumulators[CONTROL_DRUG]
global_dmso_baseline = dmso_stats['sum'] / dmso_stats['count']
print(f"Global DMSO baseline computed from {dmso_stats['count']} samples.")

# Compute deltas for all drugs (excluding DMSO itself)
final_drug_deltas = {}

for drug, stats in drug_accumulators.items():
    if drug == CONTROL_DRUG:
        continue  # Skip DMSO itself
    
    # Compute global mean for this drug (average over all treated embeddings)
    drug_mean = stats['sum'] / stats['count']
    
    # KEY STEP: Vector Subtraction
    # "Drug Effect" = "Drug State" - "Global Baseline State"
    delta = drug_mean - global_dmso_baseline
    
    final_drug_deltas[drug] = delta

print(f"Aggregation Complete. Computed deltas for {len(final_drug_deltas)} unique drugs.")

# 7. UPLOAD TO QDRANT
print(f"Uploading signatures for {len(final_drug_deltas)} unique drugs plus DMSO baseline...")

points_to_upload = []

# Add DMSO to DMSO entry (zero vector, since DMSO - DMSO = 0)
dmso_to_dmso_delta = np.zeros(vector_dim)
dmso_sample_count = drug_accumulators[CONTROL_DRUG]['count']
dmso_point_id = abs(hash(f"{TARGET_CELL_LINE}_{CONTROL_DRUG}"))
points_to_upload.append(PointStruct(
    id=dmso_point_id,
    vector=dmso_to_dmso_delta.tolist(),
    payload={
        "drug": CONTROL_DRUG,
        "cell_line": TARGET_CELL_LINE,
        "samples_aggregated": dmso_sample_count,
    }
))

for drug, delta in final_drug_deltas.items():
    # Get the count of samples used for this drug
    drug_sample_count = drug_accumulators[drug]['count']
    
    # Create deterministic ID based on Drug Name
    # (Using string hashing so we don't need a counter)
    point_id = abs(hash(f"{TARGET_CELL_LINE}_{drug}"))
    
    points_to_upload.append(PointStruct(
        id=point_id,
        vector=delta.tolist(),
        payload={
            "drug": drug,
            "cell_line": TARGET_CELL_LINE,
            "samples_aggregated": drug_sample_count,            
        }
    ))

if points_to_upload:
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points_to_upload
    )
    print(f"SUCCESS: Uploaded {len(points_to_upload)} vectors to '{COLLECTION_NAME}'.")
else:
    print("WARNING: No vectors to upload. (Did you process enough rows to find DMSO controls and treated samples?)")

os._exit(0)