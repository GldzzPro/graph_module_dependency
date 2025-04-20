# -*- coding: utf-8 -*-
import requests
import logging
import time
from typing import Dict, List, Any, Optional, Tuple
from requests.exceptions import RequestException
from config import Config

logger = logging.getLogger(__name__)

class GraphFetcher:
    """Class for fetching module dependency graphs from Odoo via JSON-RPC."""
    
    def __init__(self, host: str = None, max_retries: int = None, retry_delay: int = None):
        """Initialize the fetcher with configuration."""
        self.host = host or Config.ODOO_HOST
        self.max_retries = max_retries or Config.MAX_RETRIES
        self.retry_delay = retry_delay or Config.RETRY_DELAY
        logger.info(f"Initialized GraphFetcher with host: {self.host}")
    
    def fetch_module_graph(self, module_ids: List[int], options: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Fetch module dependency graph data from Odoo.
        
        Args:
            module_ids: List of module IDs to fetch the graph for
            options: Dictionary of options for the graph API
            
        Returns:
            Dictionary containing nodes and edges of the graph, or None if failed
        """
        endpoint = f"{self.host}/api/graph/module"
        return self._make_request(endpoint, module_ids, options)
    
    def fetch_reverse_graph(self, module_ids: List[int], options: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Fetch reverse module dependency graph data from Odoo.
        
        Args:
            module_ids: List of module IDs to fetch the graph for
            options: Dictionary of options for the graph API
            
        Returns:
            Dictionary containing nodes and edges of the graph, or None if failed
        """
        endpoint = f"{self.host}/api/graph/reverse"
        return self._make_request(endpoint, module_ids, options)
    
    def _make_request(self, endpoint: str, module_ids: List[int], options: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Make a JSON-RPC request to the Odoo API with retry logic.
        
        Args:
            endpoint: API endpoint URL
            module_ids: List of module IDs
            options: Dictionary of options
            
        Returns:
            Response data or None if failed
        """
        payload = {
            "jsonrpc": "2.0",
            "method": "call",
            "params": {
                "module_ids": module_ids,
                "options": options
            },
            "id": 1
        }
        
        headers = {"Content-Type": "application/json"}
        
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(f"Attempt {attempt}/{self.max_retries} to fetch data from {endpoint}")
                response = requests.post(endpoint, json=payload, headers=headers)
                response.raise_for_status()
                
                data = response.json()
                
                # Check for JSON-RPC error
                if "error" in data:
                    error = data["error"]
                    logger.error(f"JSON-RPC error: {error.get('message')}")
                    return None
                
                # Extract result from JSON-RPC response
                if "result" in data:
                    logger.info(f"Successfully fetched graph data with {len(data['result'].get('nodes', []))} nodes")
                    return data["result"]
                
                logger.warning("Unexpected response format: 'result' field missing")
                return None
                
            except RequestException as e:
                logger.error(f"Request failed: {str(e)}")
                if attempt < self.max_retries:
                    logger.info(f"Retrying in {self.retry_delay} seconds...")
                    time.sleep(self.retry_delay)
                else:
                    logger.error("Max retries reached. Giving up.")
                    return None
        
        return None
    
    def extract_graph_components(self, graph_data: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Extract nodes and edges from graph data.
        
        Args:
            graph_data: Graph data returned from the API
            
        Returns:
            Tuple of (nodes, edges)
        """
        if not graph_data:
            return [], []
        
        nodes = graph_data.get("nodes", [])
        edges = graph_data.get("edges", [])
        
        logger.info(f"Extracted {len(nodes)} nodes and {len(edges)} edges from graph data")
        return nodes, edges