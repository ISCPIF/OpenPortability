from fastapi import FastAPI, Request, Response, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, HttpUrl
from typing import Optional, Dict, Any, List, Union
import httpx
import os
import json
import time
import uuid
from loguru import logger
from dotenv import load_dotenv
import re

# Import database manager
from db.db_manager import connect_db, disconnect_db

# Import routers
from routes.mastodon_auth import router as mastodon_auth_router

# Load environment variables
load_dotenv()

# Configure logging
os.makedirs("logs", exist_ok=True)  # Ensure logs directory exists
logger.add("logs/proxy_api.log", rotation="10 MB", retention="7 days", level="INFO")

# Initialize FastAPI app
app = FastAPI(
    title="Social Network API Proxy",
    description="A proxy service for mediating API calls to Mastodon, Bluesky, and Twitter",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request models
class ProxyRequest(BaseModel):
    url: HttpUrl
    method: str
    headers: Optional[Dict[str, str]] = None
    data: Optional[Dict[str, Any]] = None
    params: Optional[Dict[str, str]] = None

# Response model
class ProxyResponse(BaseModel):
    status_code: int
    headers: Dict[str, str]
    body: Any
    request_id: str

# Helper functions
def is_valid_mastodon_instance(domain: str) -> bool:
    """Verify if a domain is a valid Mastodon instance."""
    # Basic validation - will be expanded in validators.py
    if not domain:
        return False
    
    # Basic pattern for domains
    domain_pattern = re.compile(r'^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$')
    
    return bool(domain_pattern.match(domain))

# Include routers
app.include_router(mastodon_auth_router)

# Database startup and shutdown events
@app.on_event("startup")
async def startup_db_client():
    await connect_db()
    logger.info("Connected to database")

@app.on_event("shutdown")
async def shutdown_db_client():
    await disconnect_db()
    logger.info("Disconnected from database")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": time.time()}

# Metrics endpoint
@app.get("/metrics")
async def metrics():
    # Will be expanded with Prometheus metrics
    return {"requests_total": 0, "error_count": 0, "avg_response_time": 0}

# Mastodon proxy endpoint
@app.post("/proxy/mastodon", response_model=ProxyResponse)
async def mastodon_proxy(request: ProxyRequest):
    request_id = str(uuid.uuid4())
    logger.info(f"Mastodon request {request_id}: {request.method} {request.url}")
    
    # Extract domain from URL to verify it's a valid Mastodon instance
    domain = str(request.url).split('/')[2]
    if not is_valid_mastodon_instance(domain):
        logger.warning(f"Invalid Mastodon instance: {domain}")
        raise HTTPException(status_code=400, detail=f"Invalid Mastodon instance: {domain}")
    
    # Forward the request to the actual Mastodon API
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=request.method,
                url=str(request.url),
                headers=request.headers,
                json=request.data if request.method in ["POST", "PUT", "PATCH"] else None,
                params=request.params if request.method == "GET" else None,
            )
            
            # Log response summary
            logger.info(f"Mastodon response {request_id}: Status {response.status_code}")
            
            # Return proxy response
            return ProxyResponse(
                status_code=response.status_code,
                headers=dict(response.headers),
                body=response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text,
                request_id=request_id
            )
    except Exception as e:
        logger.error(f"Mastodon request {request_id} error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# # Bluesky proxy endpoint
# @app.post("/proxy/bluesky", response_model=ProxyResponse)
# async def bluesky_proxy(request: ProxyRequest):
#     request_id = str(uuid.uuid4())
#     logger.info(f"Bluesky request {request_id}: {request.method} {request.url}")
    
#     # Verify it's a valid Bluesky API domain
#     allowed_domains = os.getenv("BLUESKY_API_DOMAINS", "bsky.social").split(",")
#     domain = str(request.url).split('/')[2]
    
#     if domain not in allowed_domains:
#         logger.warning(f"Invalid Bluesky API domain: {domain}")
#         raise HTTPException(status_code=400, detail=f"Invalid Bluesky API domain: {domain}")
    
#     # Forward the request to the actual Bluesky API
#     try:
#         async with httpx.AsyncClient(timeout=30.0) as client:
#             response = await client.request(
#                 method=request.method,
#                 url=str(request.url),
#                 headers=request.headers,
#                 json=request.data if request.method in ["POST", "PUT", "PATCH"] else None,
#                 params=request.params if request.method == "GET" else None,
#             )
            
#             # Log response summary
#             logger.info(f"Bluesky response {request_id}: Status {response.status_code}")
            
#             # Return proxy response
#             return ProxyResponse(
#                 status_code=response.status_code,
#                 headers=dict(response.headers),
#                 body=response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text,
#                 request_id=request_id
#             )
#     except Exception as e:
#         logger.error(f"Bluesky request {request_id} error: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# # Twitter/X proxy endpoint
# @app.post("/proxy/twitter", response_model=ProxyResponse)
# async def twitter_proxy(request: ProxyRequest):
#     request_id = str(uuid.uuid4())
#     logger.info(f"Twitter request {request_id}: {request.method} {request.url}")
    
#     # Verify it's a valid Twitter API domain
#     allowed_domains = os.getenv("TWITTER_API_DOMAINS", "api.twitter.com").split(",")
#     domain = str(request.url).split('/')[2]
    
#     if domain not in allowed_domains:
#         logger.warning(f"Invalid Twitter API domain: {domain}")
#         raise HTTPException(status_code=400, detail=f"Invalid Twitter API domain: {domain}")
    
#     # Forward the request to the actual Twitter API
#     try:
#         async with httpx.AsyncClient(timeout=30.0) as client:
#             response = await client.request(
#                 method=request.method,
#                 url=str(request.url),
#                 headers=request.headers,
#                 json=request.data if request.method in ["POST", "PUT", "PATCH"] else None,
#                 params=request.params if request.method == "GET" else None,
#             )
            
#             # Log response summary
#             logger.info(f"Twitter response {request_id}: Status {response.status_code}")
            
#             # Return proxy response
#             return ProxyResponse(
#                 status_code=response.status_code,
#                 headers=dict(response.headers),
#                 body=response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text,
#                 request_id=request_id
#             )
#     except Exception as e:
#         logger.error(f"Twitter request {request_id} error: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
