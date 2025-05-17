"""
Optimized analysis module for feedback data processing.
Contains functions for sentiment analysis and keyword extraction with caching.
"""

import logging
import re
from typing import List, Dict, Any, Tuple
from collections import Counter
from functools import lru_cache

import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from textblob import TextBlob
import subprocess
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Global cache variables
_stopwords = None
_sentiment_cache = {}
_keywords_cache = {}


# Initialize NLP resources
def init_nlp_resources():
    """Initialize and cache NLP resources for better performance."""
    global _stopwords

    try:
        # Check if NLTK resources are available
        nltk.data.find('tokenizers/punkt')
        nltk.data.find('corpora/stopwords')
        logger.debug("NLTK resources already available")
    except LookupError:
        logger.info("Downloading NLTK resources")
        try:
            nltk.download('punkt', quiet=True)
            nltk.download('stopwords', quiet=True)
            logger.info("NLTK resources downloaded successfully")
        except Exception as e:
            logger.error(f"Failed to download NLTK resources: {e}")
            raise

    # Cache stopwords for reuse
    _stopwords = set(stopwords.words('english'))

    # Ensure TextBlob corpora
    try:
        # Test if TextBlob is working properly
        TextBlob("test").sentiment
        logger.debug("TextBlob corpora already available")
    except Exception as e:
        logger.info("Downloading TextBlob corpora")
        try:
            subprocess.check_call([sys.executable, "-m", "textblob.download_corpora"])
            logger.info("TextBlob corpora downloaded successfully")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to download TextBlob corpora: {e}")
            raise


# Call initialization when module is imported
init_nlp_resources()


@lru_cache(maxsize=1000)
def get_sentiment_score(message: str) -> float:
    """
    Returns a numerical sentiment score for a feedback message (between -1 and 1).
    Uses TextBlob for sentiment analysis with caching for performance.
    """
    if not message or not isinstance(message, str):
        return 0.0

    # Check cache first
    if message in _sentiment_cache:
        return _sentiment_cache[message]

    try:
        blob = TextBlob(message)
        score = round(blob.sentiment.polarity, 2)
        # Cache result
        _sentiment_cache[message] = score
        return score
    except Exception as e:
        logger.error(f"Error in get_sentiment_score: {e}")
        return 0.0


@lru_cache(maxsize=1000)
def classify_sentiment(message: str) -> str:
    """
    Classifies the sentiment of a feedback message as positive, negative, or neutral.
    Uses TextBlob for sentiment analysis with caching for performance.
    """
    if not message or not isinstance(message, str):
        return "neutral"

    # Use cached sentiment score
    score = get_sentiment_score(message)

    if score > 0.1:
        return "positive"
    elif score < -0.1:
        return "negative"
    else:
        return "neutral"


@lru_cache(maxsize=500)
def extract_top_keywords(message: str, top_n: int = 5) -> List[Tuple[str, int]]:
    """
    Extracts the top N keywords from a feedback message using word frequency.
    Returns a list of (keyword, frequency) tuples with caching for performance.
    """
    global _stopwords

    if not message or not isinstance(message, str):
        return []

    # Check cache first
    cache_key = f"{message}_{top_n}"
    if cache_key in _keywords_cache:
        return _keywords_cache[cache_key]

    try:
        # Preprocess the message
        message = re.sub(r'[^\w\s]', '', message.lower())

        # Tokenize and remove stopwords
        tokens = word_tokenize(message)
        tokens = [word for word in tokens if word not in _stopwords and len(word) > 2]

        # Count word frequencies
        word_freq = Counter(tokens)
        result = word_freq.most_common(top_n)

        # Cache result
        _keywords_cache[cache_key] = result
        return result
    except Exception as e:
        logger.error(f"Error in extract_top_keywords: {e}")
        return []


def analyze_feedback(collection):
    """
    Analyzes feedback data from MongoDB collection.
    Returns average rating, total feedback count, and feedback type counts.
    Uses aggregation pipeline for better performance.
    """
    try:
        # Use MongoDB aggregation pipeline for better performance
        pipeline = [
            {
                "$group": {
                    "_id": None,
                    "total_feedback": {"$sum": 1},
                    "total_rating": {"$sum": "$rating"},
                    "feedbackTypes": {"$push": "$feedbackType"}
                }
            }
        ]

        result = list(collection.aggregate(pipeline))

        if not result:
            return {
                "average_rating": 0.0,
                "total_feedback": 0,
                "feedback_type_counts": {}
            }

        data = result[0]
        total_feedback = data.get("total_feedback", 0)
        total_rating = data.get("total_rating", 0)

        # Calculate average rating
        average_rating = round(total_rating / total_feedback, 2) if total_feedback > 0 else 0.0

        # Calculate feedback type counts
        feedback_types = data.get("feedbackTypes", [])
        feedback_type_counts = Counter(feedback_types)

        return {
            "average_rating": average_rating,
            "total_feedback": total_feedback,
            "feedback_type_counts": dict(feedback_type_counts)
        }
    except Exception as e:
        logger.error(f"Error in analyze_feedback: {e}")
        raise


def analyze_service_feedback(collection, service: str):
    """
    Analyzes feedback for a specific service.
    Returns total feedbacks, average rating, average sentiment, sentiment breakdown, and top keywords.
    Uses aggregation pipeline and caching for better performance.
    """
    try:
        # Use MongoDB aggregation pipeline for better performance
        pipeline = [
            {"$match": {"service": service}},
            {
                "$group": {
                    "_id": None,
                    "total_feedback": {"$sum": 1},
                    "total_rating": {"$sum": "$rating"},
                    "messages": {"$push": "$message"}
                }
            }
        ]

        result = list(collection.aggregate(pipeline))

        if not result:
            return {
                "total_feedback": 0,
                "average_rating": 0.0,
                "average_sentiment": 0.0,
                "sentiment_breakdown": {"positive": 0, "neutral": 0, "negative": 0},
                "top_keywords": []
            }

        data = result[0]
        total_feedback = data.get("total_feedback", 0)
        total_rating = data.get("total_rating", 0)
        messages = data.get("messages", [])

        # Calculate average rating
        average_rating = round(total_rating / total_feedback, 2) if total_feedback > 0 else 0.0

        # Calculate sentiment data
        sentiments = []
        sentiment_breakdown = {"positive": 0, "neutral": 0, "negative": 0}
        all_keywords = []

        for message in messages:
            if message and isinstance(message, str):
                # Get sentiment (uses cache)
                sentiment_score = get_sentiment_score(message)
                sentiment = classify_sentiment(message)

                sentiments.append(sentiment_score)
                sentiment_breakdown[sentiment] += 1

                # Get keywords (uses cache)
                keywords = extract_top_keywords(message, top_n=10)
                all_keywords.extend([word for word, _ in keywords])

        # Calculate average sentiment
        average_sentiment = round(sum(sentiments) / len(sentiments), 2) if sentiments else 0.0

        # Get top keywords
        keyword_counts = Counter(all_keywords)
        top_keywords = [word for word, _ in keyword_counts.most_common(5)]

        return {
            "total_feedback": total_feedback,
            "average_rating": average_rating,
            "average_sentiment": average_sentiment,
            "sentiment_breakdown": sentiment_breakdown,
            "top_keywords": top_keywords
        }
    except Exception as e:
        logger.error(f"Error in analyze_service_feedback: {e}")
        raise


def precompute_sentiment_data(collection) -> Dict[str, Any]:
    """
    Precompute and cache sentiment and keywords for all documents.
    This can be called periodically to warm up caches.
    """
    try:
        all_docs = list(collection.find({}, {"_id": 1, "message": 1}))

        for doc in all_docs:
            message = doc.get("message", "")
            if message and isinstance(message, str):
                # Precompute and cache sentiment
                score = get_sentiment_score(message)
                sentiment = classify_sentiment(message)

                # Precompute and cache keywords
                extract_top_keywords(message, top_n=10)

        logger.info(f"Precomputed sentiment and keywords for {len(all_docs)} documents")
        return {"status": "success", "processed_docs": len(all_docs)}
    except Exception as e:
        logger.error(f"Error in precompute_sentiment_data: {e}")
        return {"status": "error", "error": str(e)}