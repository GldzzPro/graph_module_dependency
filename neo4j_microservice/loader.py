# -*- coding: utf-8 -*-
import logging
from typing import Dict, List, Any, Optional
from neo4j import GraphDatabase, Driver, Session
from neo4j.exceptions import Neo4jError
from config import Config

logger = logging.getLogger(__name__)

class Neo4jLoader:
    """Class for loading module dependency graph data into Neo4j."""
    
    def __init__(self, uri: str = None, user: str = None, password: str = None):
        """Initialize the Neo4j connection."""
        self.uri = uri or Config.NEO4J_URI
        self.user = user or Config.NEO4J_USER
        self.password = password or Config.NEO4J_PASSWORD
        self.driver = None
        logger.info(f"Initialized Neo4jLoader with URI: {self.uri}")
    
    def connect(self) -> bool:
        """Establish connection to Neo4j database.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
            # Verify connection by running a simple query
            with self.driver.session() as session:
                session.run("RETURN 1")
            logger.info("Successfully connected to Neo4j database")
            return True
        except Neo4jError as e:
            logger.error(f"Failed to connect to Neo4j: {str(e)}")
            return False
    
    def close(self) -> None:
        """Close the Neo4j connection."""
        if self.driver:
            self.driver.close()
            logger.info("Neo4j connection closed")
    
    def load_nodes(self, nodes: List[Dict[str, Any]]) -> bool:
        """Load nodes into Neo4j using batch processing.
        
        Args:
            nodes: List of node dictionaries from the graph API
            
        Returns:
            True if successful, False otherwise
        """
        if not nodes:
            logger.warning("No nodes to load")
            return True
        
        if not self.driver:
            logger.error("Not connected to Neo4j. Call connect() first.")
            return False
        
        try:
            with self.driver.session() as session:
                # Create constraint if it doesn't exist
                self._create_constraints(session)
                
                # Batch process nodes using UNWIND
                query = """
                UNWIND $nodes AS node
                MERGE (m:Module {id: node.id})
                SET m += node.properties
                """
                
                # Prepare node data for Neo4j
                node_data = [{
                    "id": node.get("id"),
                    "properties": {k: v for k, v in node.items() if k != "id"}
                } for node in nodes]
                
                result = session.run(query, nodes=node_data)
                summary = result.consume()
                
                logger.info(f"Loaded {len(nodes)} nodes into Neo4j")
                return True
                
        except Neo4jError as e:
            logger.error(f"Error loading nodes into Neo4j: {str(e)}")
            return False
    
    def load_edges(self, edges: List[Dict[str, Any]]) -> bool:
        """Load edges into Neo4j using batch processing.
        
        Args:
            edges: List of edge dictionaries from the graph API
            
        Returns:
            True if successful, False otherwise
        """
        if not edges:
            logger.warning("No edges to load")
            return True
        
        if not self.driver:
            logger.error("Not connected to Neo4j. Call connect() first.")
            return False
        
        try:
            with self.driver.session() as session:
                # Batch process edges using UNWIND
                query = """
                UNWIND $edges AS edge
                MATCH (source:Module {id: edge.from_id})
                MATCH (target:Module {id: edge.to_id})
                MERGE (source)-[r:DEPENDS_ON]->(target)
                SET r.type = edge.type,
                    r.in_cycle = edge.in_cycle,
                    r.cycle_id = edge.cycle_id
                """
                
                # Prepare edge data for Neo4j
                edge_data = [{
                    "from_id": edge.get("from"),
                    "to_id": edge.get("to"),
                    "type": edge.get("type", "dependency"),
                    "in_cycle": edge.get("in_cycle", False),
                    "cycle_id": edge.get("cycle_id")
                } for edge in edges]
                
                result = session.run(query, edges=edge_data)
                summary = result.consume()
                
                logger.info(f"Loaded {len(edges)} edges into Neo4j")
                return True
                
        except Neo4jError as e:
            logger.error(f"Error loading edges into Neo4j: {str(e)}")
            return False
    
    def _create_constraints(self, session: Session) -> None:
        """Create necessary constraints in Neo4j."""
        try:
            # Check if constraint exists (Neo4j 4.x+)
            constraint_query = """
            SHOW CONSTRAINTS
            YIELD name, labelsOrTypes, properties
            WHERE labelsOrTypes = ['Module'] AND properties = ['id']
            RETURN count(*) > 0 AS exists
            """
            
            try:
                result = session.run(constraint_query)
                constraint_exists = result.single()["exists"]
            except:
                # Fallback for older Neo4j versions
                constraint_exists = False
            
            if not constraint_exists:
                # Create constraint
                session.run("CREATE CONSTRAINT module_id IF NOT EXISTS FOR (m:Module) REQUIRE m.id IS UNIQUE")
                logger.info("Created constraint on Module.id")
                
        except Neo4jError as e:
            logger.warning(f"Error checking/creating constraints: {str(e)}")
            # Try legacy constraint syntax for older Neo4j versions
            try:
                session.run("CREATE CONSTRAINT ON (m:Module) ASSERT m.id IS UNIQUE")
                logger.info("Created constraint on Module.id using legacy syntax")
            except Neo4jError as e2:
                logger.error(f"Failed to create constraint with legacy syntax: {str(e2)}")