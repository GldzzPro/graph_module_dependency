# -*- coding: utf-8 -*-
import logging
import sys
import time
from typing import Dict, List, Any, Optional, Tuple

from config import Config
from fetcher import GraphFetcher
from loader import Neo4jLoader

logger = logging.getLogger(__name__)

class ModuleGraphMicroservice:
    """Main class for the microservice that orchestrates the process."""
    
    def __init__(self):
        """Initialize the microservice components."""
        self.config = Config
        self.fetcher = GraphFetcher()
        self.loader = Neo4jLoader()
        logger.info("Initialized ModuleGraphMicroservice")
    
    def run(self) -> bool:
        """Run the complete process of fetching and loading graph data.
        
        Returns:
            True if successful, False otherwise
        """
        # Validate configuration
        if not self.config.validate():
            logger.error("Invalid configuration. Exiting.")
            return False
        
        # Connect to Neo4j
        if not self.loader.connect():
            logger.error("Failed to connect to Neo4j. Exiting.")
            return False
        
        try:
            # Fetch module graph data
            logger.info(f"Fetching module graph for module_ids={self.config.MODULE_IDS} with options={self.config.OPTIONS}")
            graph_data = self.fetcher.fetch_module_graph(
                self.config.MODULE_IDS,
                self.config.OPTIONS
            )
            
            if not graph_data:
                logger.error("Failed to fetch module graph data. Exiting.")
                return False
            
            # Extract nodes and edges
            nodes, edges = self.fetcher.extract_graph_components(graph_data)
            
            if not nodes:
                logger.warning("No nodes found in the graph data")
            
            # Load nodes into Neo4j
            if nodes and not self.loader.load_nodes(nodes):
                logger.error("Failed to load nodes into Neo4j")
                return False
            
            # Load edges into Neo4j
            if edges and not self.loader.load_edges(edges):
                logger.error("Failed to load edges into Neo4j")
                return False
            
            logger.info("Successfully completed the graph data ingestion process")
            return True
            
        except Exception as e:
            logger.exception(f"Unexpected error: {str(e)}")
            return False
        
        finally:
            # Close Neo4j connection
            self.loader.close()


def main():
    """Main entry point for the microservice."""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    logger.info("Starting Odoo Module Graph to Neo4j microservice")
    
    # Create and run the microservice
    service = ModuleGraphMicroservice()
    success = service.run()
    
    if success:
        logger.info("Microservice completed successfully")
        sys.exit(0)
    else:
        logger.error("Microservice failed")
        sys.exit(1)


if __name__ == "__main__":
    main()