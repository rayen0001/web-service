"""
GraphQL schema definition for the feedback analysis API.
Contains type definitions and resolvers with performance optimizations.
"""

import strawberry
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import logging
from pymongo import MongoClient
import os
from dotenv import load_dotenv

from analysis import (
    analyze_feedback,
    analyze_service_feedback,
    extract_top_keywords,
    classify_sentiment,
    get_sentiment_score
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# MongoDB configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/feedback")
DB_NAME = os.getenv("DB_NAME", "feedback")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "feedbacks")


# Database connection factory (uses connection pooling)
def get_db():
    client = MongoClient(MONGO_URI, maxPoolSize=50)
    db = client[DB_NAME]
    return db


# Type definitions
@strawberry.type
class Keyword:
    word: str
    frequency: int


@strawberry.type
class KeyValuePair:
    key: str
    value: int


@strawberry.type
class Feedback:
    id: str
    name: str
    email: str
    feedback_type: str
    service: str
    message: str
    rating: int
    attach_screenshot: bool
    agree_to_terms: bool
    created_at: datetime
    updated_at: datetime
    sentiment: str
    sentiment_score: float
    top_keywords: List[Keyword]


@strawberry.type
class FeedbackAnalysis:
    average_rating: float
    total_feedback: int
    feedback_type_counts: List[KeyValuePair]
    sentiment_counts: List[KeyValuePair]


@strawberry.type
class SentimentBreakdown:
    positive: int
    neutral: int
    negative: int


@strawberry.type
class ServiceAnalysis:
    service: str
    total_feedback: int
    average_rating: float
    average_sentiment: float
    sentiment_breakdown: SentimentBreakdown
    top_keywords: List[str]


# GraphQL Query resolver
@strawberry.type
class Query:
    @strawberry.field
    def feedbacks(self, limit: int = 10, skip: int = 0) -> List[Feedback]:
        """Get a paginated list of feedback entries with sentiment analysis."""
        db = get_db()
        collection = db[COLLECTION_NAME]

        # Use projection and sorting for better performance
        feedback_list = collection.find().sort("createdAt", -1).skip(skip).limit(limit)

        result = []
        for f in feedback_list:
            message = f.get("message", "")
            sentiment = classify_sentiment(message)
            sentiment_score = get_sentiment_score(message)

            keywords = [
                Keyword(word=word, frequency=freq)
                for word, freq in extract_top_keywords(message)
            ]

            result.append(
                Feedback(
                    id=str(f["_id"]),
                    name=f["name"],
                    email=f["email"],
                    feedback_type=f["feedbackType"],
                    service=f["service"],
                    message=message,
                    rating=f["rating"],
                    attach_screenshot=f["attachScreenshot"],
                    agree_to_terms=f["agreeToTerms"],
                    created_at=f["createdAt"],
                    updated_at=f["updatedAt"],
                    sentiment=sentiment,
                    sentiment_score=sentiment_score,
                    top_keywords=keywords,
                )
            )

        return result

    @strawberry.field
    def feedback_by_id(self, id: str) -> Optional[Feedback]:
        """Get a specific feedback entry by ID with sentiment analysis."""
        db = get_db()
        collection = db[COLLECTION_NAME]

        try:
            feedback = collection.find_one({"_id": ObjectId(id)})

            if feedback:
                message = feedback.get("message", "")
                sentiment = classify_sentiment(message)
                sentiment_score = get_sentiment_score(message)

                keywords = [
                    Keyword(word=word, frequency=freq)
                    for word, freq in extract_top_keywords(message)
                ]

                return Feedback(
                    id=str(feedback["_id"]),
                    name=feedback["name"],
                    email=feedback["email"],
                    feedback_type=feedback["feedbackType"],
                    service=feedback["service"],
                    message=message,
                    rating=feedback["rating"],
                    attach_screenshot=feedback["attachScreenshot"],
                    agree_to_terms=feedback["agreeToTerms"],
                    created_at=feedback["createdAt"],
                    updated_at=feedback["updatedAt"],
                    sentiment=sentiment,
                    sentiment_score=sentiment_score,
                    top_keywords=keywords,
                )
            return None
        except Exception as e:
            logger.error(f"Error in feedback_by_id: {e}")
            return None

    @strawberry.field
    def feedback_analysis(self) -> FeedbackAnalysis:
        """Get overall feedback analysis with aggregated metrics."""
        db = get_db()
        collection = db[COLLECTION_NAME]

        analysis = analyze_feedback(collection)

        # Calculate sentiment counts using aggregation
        pipeline = [
            {"$project": {"message": 1}},
            {"$group": {"_id": None, "messages": {"$push": "$message"}}}
        ]

        result = list(collection.aggregate(pipeline))
        sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}

        if result:
            messages = result[0].get("messages", [])
            for message in messages:
                if message and isinstance(message, str):
                    sentiment = classify_sentiment(message)
                    sentiment_counts[sentiment] += 1

        # Convert dicts to List[KeyValuePair]
        feedback_type_counts = [
            KeyValuePair(key=key, value=value)
            for key, value in analysis["feedback_type_counts"].items()
        ]

        sentiment_counts_list = [
            KeyValuePair(key=key, value=value)
            for key, value in sentiment_counts.items()
        ]

        return FeedbackAnalysis(
            average_rating=analysis["average_rating"],
            total_feedback=analysis["total_feedback"],
            feedback_type_counts=feedback_type_counts,
            sentiment_counts=sentiment_counts_list,
        )

    @strawberry.field
    def service_analysis(self, service: str) -> ServiceAnalysis:
        """Get analysis for a specific service with detailed metrics."""
        db = get_db()
        collection = db[COLLECTION_NAME]

        analysis = analyze_service_feedback(collection, service)

        return ServiceAnalysis(
            service=service,
            total_feedback=analysis["total_feedback"],
            average_rating=analysis["average_rating"],
            average_sentiment=analysis["average_sentiment"],
            sentiment_breakdown=SentimentBreakdown(
                positive=analysis["sentiment_breakdown"]["positive"],
                neutral=analysis["sentiment_breakdown"]["neutral"],
                negative=analysis["sentiment_breakdown"]["negative"],
            ),
            top_keywords=analysis["top_keywords"],
        )