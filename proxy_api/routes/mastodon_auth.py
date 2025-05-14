from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from loguru import logger
import time
import uuid

# Import our database manager for Mastodon instances
from ..db.db_manager import get_mastodon_instances, add_mastodon_instance, is_valid_mastodon_instance

# Create router for Mastodon auth endpoints
router = APIRouter(prefix="/auth/mastodon", tags=["mastodon"])

@router.get("/instances")
async def get_mastodon_instances_route():
    """
    Get all valid Mastodon instances.
    
    This endpoint returns a list of valid Mastodon instances that users can connect to.
    Equivalent to the Next.js /api/auth/mastodon route.
    """
    request_id = str(uuid.uuid4())
    logger.info(f"Request {request_id}: GET /auth/mastodon/instances")
    
    try:
        # Fetch instances from database
        instances = await get_mastodon_instances()
        
        logger.info(f"Request {request_id}: Successfully fetched {len(instances)} Mastodon instances")
        
        # Return in the same format as the Next.js API
        return {
            "success": True,
            "instances": instances
        }
        
    except Exception as e:
        logger.error(f"Request {request_id} error: {str(e)}")
        
        # Match the Next.js API error response format
        return {
            "success": False,
            "error": "Failed to fetch Mastodon instances"
        }, 500

@router.post("/instances")
async def add_mastodon_instance_route(instance_data: Dict[str, str]):
    """
    Add a new Mastodon instance to the whitelist.
    
    This endpoint allows adding new Mastodon instances to the valid list.
    Requires an instance domain in the request body.
    """
    request_id = str(uuid.uuid4())
    
    # Check if instance is provided
    if "instance" not in instance_data:
        logger.warning(f"Request {request_id}: Missing instance in request body")
        return {
            "success": False,
            "error": "Missing instance domain"
        }, 400
    
    instance = instance_data["instance"]
    logger.info(f"Request {request_id}: POST /auth/mastodon/instances - {instance}")
    
    try:
        # Add instance to database
        success = await add_mastodon_instance(instance)
        
        if success:
            logger.info(f"Request {request_id}: Successfully added Mastodon instance {instance}")
            return {
                "success": True,
                "message": f"Added instance {instance} to whitelist"
            }
        else:
            logger.error(f"Request {request_id}: Failed to add Mastodon instance {instance}")
            return {
                "success": False,
                "error": "Failed to add Mastodon instance"
            }, 500
        
    except Exception as e:
        logger.error(f"Request {request_id} error: {str(e)}")
        return {
            "success": False,
            "error": "An unexpected error occurred"
        }, 500

@router.get("/verify/{instance}")
async def verify_mastodon_instance(instance: str):
    """
    Verify if a given Mastodon instance is in the whitelist.
    
    This endpoint checks if the provided instance is valid and allowed.
    """
    request_id = str(uuid.uuid4())
    logger.info(f"Request {request_id}: GET /auth/mastodon/verify/{instance}")
    
    try:
        valid = await is_valid_mastodon_instance(instance)
        
        logger.info(f"Request {request_id}: Instance {instance} validity check: {valid}")
        
        return {
            "success": True,
            "valid": valid
        }
        
    except Exception as e:
        logger.error(f"Request {request_id} error: {str(e)}")
        return {
            "success": False,
            "error": "Failed to verify Mastodon instance"
        }, 500
