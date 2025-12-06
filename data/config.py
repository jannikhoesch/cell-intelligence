import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient

# Load environment variables from .env file
load_dotenv()

# Qdrant Cloud configuration - both are required
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

# Validate that required environment variables are set
if not QDRANT_URL or not QDRANT_API_KEY:
    raise ValueError(
        "QDRANT_URL and QDRANT_API_KEY environment variables must be set. "
        "Get them from https://cloud.qdrant.io"
    )

client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY
)
