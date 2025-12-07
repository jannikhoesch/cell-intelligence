# Drug Similarity API Deployment

## Deploy to Railway (Recommended)

1. Push your API code to a GitHub repo
2. Go to [railway.app](https://railway.app) and create new project from GitHub
3. Add environment variables in Railway dashboard:
   - `QDRANT_URL`: Your Qdrant Cloud URL
   - `QDRANT_API_KEY`: Your Qdrant API key
   - `CORS_ORIGINS`: Your Lovable app URL (e.g., `https://eecf4d93-b657-4830-8356-f35ae9718ee4.lovableproject.com`)
4. Railway will auto-deploy using the Procfile
5. Copy the public URL (e.g., `https://your-app.railway.app`)

## Deploy to Render

1. Push your API code to GitHub
2. Go to [render.com](https://render.com) and create new Web Service
3. Select your repo, set:
   - Runtime: Python 3
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables in Render dashboard
5. Copy the public URL

## Deploy to Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login and launch
fly auth login
fly launch
fly secrets set QDRANT_URL=... QDRANT_API_KEY=...
fly deploy
```

## After Deployment

Update the frontend by setting `DEFAULT_API_URL` in `src/hooks/useApiConnection.ts` to your deployed API URL.
