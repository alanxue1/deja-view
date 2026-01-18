import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.utils.logging_config import setup_logging


# Setup logging before anything else
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    """
    # Startup
    logger.info("Starting Pinterest Extraction API")
    logger.info(f"Health check available at /health")
    logger.info(f"API docs available at /docs")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Pinterest Extraction API")


app = FastAPI(
    title="Pinterest Pin Extraction API",
    description="Extracts pins from Pinterest boards and analyzes them using LLM for furniture extraction",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for hackathon flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(router)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}
