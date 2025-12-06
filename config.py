from qdrant_client import QdrantClient

client = QdrantClient(
    url="https://2ed65f56-76cc-4025-9bec-ce6d7000de69.europe-west3-0.gcp.cloud.qdrant.io:6333",
    api_key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.RkruWtupatILfVmKPFiVqUQlXvlM9dh_NDX3z-EH4D4",
)

print(client.get_collections())
