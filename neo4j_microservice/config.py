# -*- coding: utf-8 -*-
import os
import json
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file if it exists
load_dotenv()


class Config:
    """Configuration class for the microservice."""
    
    # Odoo Configuration
    ODOO_HOST = os.environ.get('ODOO_HOST', 'http://localhost:8069')
    
    # Module IDs to fetch (parse from JSON string)
    try:
        MODULE_IDS = json.loads(os.environ.get('MODULE_IDS', '[333]'))
        if not isinstance(MODULE_IDS, list):
            logger.warning("MODULE_IDS must be a JSON array. Using default [333]")
            MODULE_IDS = [333]
    except json.JSONDecodeError:
        logger.warning("Failed to parse MODULE_IDS. Using default [333]")
        MODULE_IDS = [333]
    
    # Options for the graph API (parse from JSON string)
    try:
        OPTIONS = json.loads(os.environ.get('OPTIONS', '{}'))
        if not isinstance(OPTIONS, dict):
            logger.warning("OPTIONS must be a JSON object. Using default {}")
            OPTIONS = {}
    except json.JSONDecodeError:
        logger.warning("Failed to parse OPTIONS. Using default {}")
        OPTIONS = {}
    
    # Neo4j Configuration
    NEO4J_URI = os.environ.get('NEO4J_URI', 'bolt://localhost:7687')
    NEO4J_USER = os.environ.get('NEO4J_USER', 'neo4j')
    NEO4J_PASSWORD = os.environ.get('NEO4J_PASSWORD', 'password')
    
    # Retry Configuration
    MAX_RETRIES = int(os.environ.get('MAX_RETRIES', 3))
    RETRY_DELAY = int(os.environ.get('RETRY_DELAY', 2))
    
    @classmethod
    def validate(cls):
        """Validate the configuration."""
        required_vars = ['ODOO_HOST', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']
        missing = [var for var in required_vars if not getattr(cls, var)]
        
        if missing:
            logger.error(f"Missing required environment variables: {', '.join(missing)}")
            return False
        
        logger.info("Configuration validated successfully")
        return True