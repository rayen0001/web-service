"""
Main application file for the feedback analysis API.
Contains FastAPI setup, middleware, and endpoint definitions with performance optimizations.
"""

import logging
import os
import sys
import time
from datetime import datetime

import strawberry
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from strawberry.asgi import GraphQL
from pymongo import MongoClient, ASCENDING, DESCENDING
from dotenv import load_dotenv
import uvicorn

from analysis import init_nlp_resources, precompute_sentiment_data
from graphql_schema import Query

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# MongoDB configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/feedback")
DB_NAME = os.getenv("DB_NAME", "feedback")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "feedbacks")
PORT = int(os.getenv("PORT", 8000))


# Get database connection
def get_db():
    client = MongoClient(MONGO_URI, maxPoolSize=50)
    db = client[DB_NAME]
    return db


# Ensure indexes exist for performance
def ensure_indexes(db):
    collection = db[COLLECTION_NAME]
    existing_indexes = collection.index_information()

    # Create indexes if they don't exist
    indexes_to_create = [
        ("service_1", [("service", ASCENDING)]),
        ("feedbackType_1", [("feedbackType", ASCENDING)]),
        ("rating_1", [("rating", ASCENDING)]),
        ("createdAt_1", [("createdAt", DESCENDING)])
    ]

    for index_name, index_spec in indexes_to_create:
        if index_name not in existing_indexes:
            field_name = index_spec[0][0]
            collection.create_index(index_spec)
            logger.info(f"Created index on {field_name} field")


def generate_schema_file():
    """
    Generates the GraphQL schema and saves it to schema.graphql in the project directory.
    """
    logger.info("Starting schema generation")
    try:
        # Create Strawberry schema
        logger.debug("Creating Strawberry schema")
        schema = strawberry.Schema(query=Query)

        # Get the schema as a string
        logger.debug("Converting schema to string")
        schema_str = str(schema)

        # Determine the path for schema.graphql
        project_dir = os.path.dirname(os.path.abspath(__file__))
        schema_path = os.path.join(project_dir, "schema.graphql")
        logger.debug(f"Schema path: {schema_path}")

        # Ensure the directory exists
        os.makedirs(project_dir, exist_ok=True)

        # Write the schema to schema.graphql
        logger.debug("Writing schema to file")
        with open(schema_path, "w", encoding="utf-8") as f:
            f.write(schema_str)

        logger.info(f"Successfully generated schema.graphql at {schema_path}")
    except Exception as e:
        logger.error(f"Failed to generate schema.graphql: {str(e)}", exc_info=True)
        raise


# Initialize FastAPI app
app = FastAPI(title="Feedback Analysis API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Allow Angular app origin
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)


# Middleware to track request processing time
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time

    # Add processing time to response headers
    response.headers["X-Process-Time"] = f"{process_time:.4f}"

    # Log slow requests (over 500ms)
    if process_time > 0.5:
        logger.warning(f"Slow request: {request.url.path} - {process_time:.4f}s")

    return response


# Create GraphQL schema
schema = strawberry.Schema(query=Query)

# Add GraphQL endpoint
graphql_app = GraphQL(schema)
app.add_route("/graphql", graphql_app)


# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint that verifies database connectivity.
    """
    try:
        # Verify database connection
        db = get_db()
        db.command("ping")

        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "unhealthy",
                "timestamp": datetime.now().isoformat(),
                "error": str(e)
            }
        )


# Endpoint to manually trigger precomputation of sentiment data
@app.post("/admin/precompute-sentiment")
async def admin_precompute_sentiment():
    """
    Admin endpoint to manually trigger sentiment and keyword precomputation.
    Useful for warming up caches after application restart or data updates.
    """
    db = get_db()
    collection = db[COLLECTION_NAME]
    start_time = time.time()
    result = precompute_sentiment_data(collection)
    elapsed_time = time.time() - start_time

    result["time_taken"] = f"{elapsed_time:.2f} seconds"
    return JSONResponse(content=result)


# Application startup event handler
@app.on_event("startup")
async def startup_event():
    """
    Runs when the application starts.
    Initializes resources, ensures indexes, and warms up caches.
    """
    logger.info("Starting application initialization")

    try:
        # Initialize NLP resources (this is just a safety check, as they should be initialized on import)
        init_nlp_resources()

        # Connect to MongoDB and ensure indexes
        db = get_db()

        # Test MongoDB connection
        db.command("ping")
        logger.info("Successfully connected to MongoDB")

        # Ensure indexes exist
        ensure_indexes(db)

        # Generate GraphQL schema file
        generate_schema_file()

        # Precompute sentiment data in background to warm up caches
        collection = db[COLLECTION_NAME]
        precompute_sentiment_data(collection)

        logger.info("Application initialization completed successfully")
    except Exception as e:
        logger.error(f"Failed to initialize application: {e}", exc_info=True)
        # We don't re-raise the exception to allow the application to start anyway
        # but admins should monitor logs for this error


if __name__ == "__main__":
    logger.info(f"Starting Uvicorn server on port {PORT}")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=PORT,
        workers=4,  # Multiple workers for better concurrency
        log_level="info"
    )