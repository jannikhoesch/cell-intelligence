# Cell Intelligence - Drug Similarity Analysis

A system for analyzing drug treatment signatures on cell lines using vector embeddings and similarity search.

## Project Structure

```
cell-intelligence/
├── backend/              # FastAPI server
│   ├── __init__.py
│   ├── main.py          # FastAPI application
│   └── models.py        # Pydantic models
│
├── data/                # Data processing and ETL
│   ├── __init__.py
│   ├── config.py        # Qdrant client configuration
│   ├── load.py          # Main data loading script
│   ├── process.py       # Data processing utilities
│   └── utils.py         # Helper functions
│
├── scripts/             # Utility scripts
│   ├── setup_db.py      # Database setup/initialization
│   └── validate_data.py # Data validation
│
├── .env                 # Environment variables (not in git)
├── .gitignore
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables in `.env`:
```
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_api_key
CORS_ORIGINS=*
```

3. Load data into Qdrant:
```bash
python -m data.load
```

4. Start the backend server:
```bash
cd backend
uvicorn main:app --reload
```

## API Endpoints

- `GET /api/drugs` - Get all drug treatment signatures
- `GET /api/drugs/{drug_id}` - Get a specific drug treatment
- `GET /api/similar/{drug_id}` - Find similar drug treatments
- `GET /api/network` - Get network graph data
- `GET /health` - Health check

