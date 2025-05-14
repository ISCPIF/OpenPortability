import os
import httpx
import asyncio
from typing import List, Dict, Any, Optional
from loguru import logger
from dotenv import load_dotenv
from databases import Database

# Load environment variables
load_dotenv()

# Get database configuration from environment variables
DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SECRET = os.getenv("SUPABASE_SECRET")

# Initialize database
database = Database(DATABASE_URL) if DATABASE_URL else None

async def connect_db():
    """Connect to the database if using direct connection."""
    if database:
        if not database.is_connected:
            await database.connect()
        return True
    return False

async def disconnect_db():
    """Disconnect from the database."""
    if database and database.is_connected:
        await database.disconnect()

async def get_mastodon_instances() -> List[str]:
    """
    Fetch the list of valid Mastodon instances from the database.
    Returns a list of instance domains.
    """
    try:
        # If we have a direct database connection, use it
        if database:
            await connect_db()
            query = "SELECT instance FROM mastodon_instances ORDER BY instance"
            results = await database.fetch_all(query)
            return [result["instance"] for result in results]
        
        # Otherwise use Supabase API
        elif SUPABASE_URL and SUPABASE_KEY:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{SUPABASE_URL}/rest/v1/mastodon_instances?select=instance",
                    headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return [item["instance"] for item in data]
                else:
                    logger.error(f"Failed to fetch Mastodon instances from Supabase: {response.text}")
                    return []
        else:
            # If no database config is available, return hardcoded instances from env
            default_instances = os.getenv("MASTODON_INSTANCES_WHITELIST", "").split(",")
            return [inst.strip() for inst in default_instances if inst.strip()]
            
    except Exception as e:
        logger.error(f"Error fetching Mastodon instances: {str(e)}")
        return []

async def add_mastodon_instance(instance: str) -> bool:
    """
    Add a new Mastodon instance to the whitelist.
    """
    try:
        # If we have a direct database connection, use it
        if database:
            await connect_db()
            query = "INSERT INTO mastodon_instances (instance) VALUES (:instance) ON CONFLICT DO NOTHING"
            await database.execute(query, values={"instance": instance})
            return True
        
        # Otherwise use Supabase API
        elif SUPABASE_URL and SUPABASE_KEY:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{SUPABASE_URL}/rest/v1/mastodon_instances",
                    headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal"
                    },
                    json={"instance": instance}
                )
                
                if response.status_code in [201, 200, 204]:
                    return True
                else:
                    logger.error(f"Failed to add Mastodon instance: {response.text}")
                    return False
        else:
            logger.error("No database configuration available")
            return False
            
    except Exception as e:
        logger.error(f"Error adding Mastodon instance: {str(e)}")
        return False

async def is_valid_mastodon_instance(instance: str) -> bool:
    """
    Check if a given Mastodon instance is in the whitelist.
    """
    instances = await get_mastodon_instances()
    return instance in instances
