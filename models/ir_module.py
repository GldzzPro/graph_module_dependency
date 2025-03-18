from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)

class Module(models.Model):
    _inherit = "ir.module.module"

    @api.model
    def get_module_graph(self, module_ids, options=None):
        """
        Build a dependency graph for the given module IDs with cycle detection.
        
        Args:
            module_ids: A list of module IDs or a single module ID
            options: Dictionary of options to control graph traversal:
                - max_depth: Maximum recursion depth (False for unlimited)
                - current_depth: Current recursion depth (used internally)
                - stop_domains: List of domain filters to determine when to stop recursion
                - exclude_domains: List of domain filters to exclude nodes from the graph
                - include_dependencies: Whether to include dependencies (default: True)
                - include_exclusions: Whether to include exclusions (default: True)
        
        Returns:
            Dictionary with 'nodes' and 'edges' representing the module graph
        """
        # Always initialize options as a dict if None
        if options is None:
            options = {}
        
        # Ensure options is a dictionary
        options = dict(options)
        
        # Initialize depth if not present
        if "current_depth" not in options:
            options["current_depth"] = 0
            
        # Initialize cycle tracking data structures if this is the root call
        if "cycle_counter" not in options:
            options["cycle_counter"] = 0  # For generating unique cycle IDs
            options["all_visited"] = set()  # Track all visited nodes across the entire traversal
            options["current_path"] = []  # Track current DFS path for cycle detection
            options["cycles"] = {}  # Map of cycle_id -> set of node IDs in cycle

        # Ensure module_ids is always a list
        if not isinstance(module_ids, list):
            module_ids = [module_ids]
        
        # Handle empty list case
        if not module_ids:
            return {"nodes": [], "edges": []}

        # Get the max depth (default to no limit if not specified)
        max_depth = options.get("max_depth", False)

        # Check if we've reached the maximum depth
        if max_depth and options["current_depth"] >= max_depth:
            return {"nodes": [], "edges": []}

        nodes = []
        edges = []

        # Get modules by IDs
        modules = self.browse(module_ids)

        # Process each module
        for module in modules:
            # Skip if we've already processed this module in the current path (cycle detected)
            if module.id in options["current_path"]:
                # Detect and process cycle
                cycle_start_index = options["current_path"].index(module.id)
                cycle_path = options["current_path"][cycle_start_index:]
                
                # Generate a new unique cycle ID
                options["cycle_counter"] += 1
                cycle_id = options["cycle_counter"]
                
                # Store the cycle nodes
                options["cycles"][cycle_id] = set(cycle_path + [module.id])
                
                # We'll skip further processing of this module to break the recursion,
                # but we've identified and stored the cycle information
                continue
                
            # Add module to the current path
            options["current_path"].append(module.id)
            
            # Add to all visited
            options["all_visited"].add(module.id)
            
            # Add the current module to nodes
            module_data = {
                "id": module.id,
                "label": module.name,
                "state": module.state,
                "depth": options["current_depth"],
            }

            # Add category information if available
            if hasattr(module, "category_id") and module.category_id:
                module_data["category"] = module.category_id.name
                module_data["category_id"] = module.category_id.id

            # Add custom flag if available
            if hasattr(module, "is_custom"):
                module_data["is_custom"] = module.is_custom

            nodes.append(module_data)

            # Check if we should stop recursion for this module
            should_stop = self._should_stop_graph_traversal(module, options)
            if should_stop:
                # Remove from current path before continuing
                options["current_path"].pop()
                continue

            # Process dependencies with incremented depth
            dependency_options = dict(options)
            dependency_options["current_depth"] = options["current_depth"] + 1

            # Process dependencies if enabled (default: True)
            if options.get("include_dependencies", True):
                dependency_modules = []
                for dependency in module.dependencies_id:
                    depended_module = dependency.depend_id
                    
                    # Check if module should be excluded
                    if self._check_module_exclusion(depended_module, options):
                        continue
                        
                    dependency_modules.append(depended_module.id)
                    
                    # Create edge data
                    edge_data = {
                        "from": module.id, 
                        "to": depended_module.id, 
                        "type": "dependency"
                    }
                    
                    edges.append(edge_data)

                if dependency_modules:
                    res = self.get_module_graph(dependency_modules, dependency_options)
                    nodes.extend(res["nodes"])
                    edges.extend(res["edges"])

            # Process exclusions if enabled (default: True)
            if options.get("include_exclusions", True) and hasattr(module, "exclusion_ids"):
                exclusion_modules = []
                for exclusion in module.exclusion_ids:
                    excluded_module = exclusion.exclusion_id
                    
                    # Check if module should be excluded
                    if self._check_module_exclusion(excluded_module, options):
                        continue
                        
                    exclusion_modules.append(excluded_module.id)
                    
                    # Create edge data
                    edge_data = {
                        "from": module.id, 
                        "to": excluded_module.id, 
                        "type": "exclusion"
                    }
                    
                    edges.append(edge_data)

                if exclusion_modules:
                    res = self.get_module_graph(exclusion_modules, dependency_options)
                    nodes.extend(res["nodes"])
                    edges.extend(res["edges"])
            
            # Remove the current module from the path when we're done with it
            options["current_path"].pop()

        # After all nodes are processed, mark cycle nodes and edges if we're at the root level
        if options.get("current_depth", 0) == 0 and options.get("cycles"):
            nodes, edges = self._mark_cycles_in_graph(nodes, edges, options.get("cycles", {}))

        # De-duplicate nodes and edges
        unique_nodes = list({node["id"]: node for node in nodes}.values())
        unique_edges = list(
            {"%s-%s" % (edge["from"], edge["to"]): edge for edge in edges}.values()
        )

        return {"nodes": unique_nodes, "edges": unique_edges}
    
    def _mark_cycles_in_graph(self, nodes, edges, cycles):
        """
        Mark all nodes and edges that are part of cycles.
        
        Args:
            nodes: List of node dictionaries
            edges: List of edge dictionaries
            cycles: Dictionary mapping cycle_id to set of node IDs in that cycle
            
        Returns:
            Tuple (nodes, edges) with cycle information added
        """
        # Process nodes
        for node in nodes:
            for cycle_id, cycle_nodes in cycles.items():
                if node["id"] in cycle_nodes:
                    node["in_cycle"] = True
                    node["cycle_id"] = cycle_id
                    node["type"] = "cycleNode"
        
        # Process edges
        for edge in edges:
            for cycle_id, cycle_nodes in cycles.items():
                # Check if both ends of the edge are in the same cycle
                if edge["from"] in cycle_nodes and edge["to"] in cycle_nodes:
                    # Check if they're adjacent in the cycle path
                    # (This requires more complex logic to determine edge direction in cycle)
                    edge["in_cycle"] = True
                    edge["cycle_id"] = cycle_id
                    edge["type"] = "cycleDirection"
        
        return nodes, edges
    
    def _should_stop_graph_traversal(self, module, options):
        """
        Determine if graph traversal should stop at this module based on stop_domains.
        
        Args:
            module: The current module record
            options: Dictionary of options with optional stop_domains
            
        Returns:
            Boolean indicating if traversal should stop
        """
        # If no stop domains, continue traversal
        if not options.get("stop_domains"):
            return False
            
        # Check each domain in stop_domains
        for domain in options.get("stop_domains", []):
            # Ensure domain is a list
            if not isinstance(domain, list):
                continue
                
            try:
                # Create a domain with the current module ID
                full_domain = [("id", "=", module.id)] + domain
                
                # Search for modules matching the domain
                matching_modules = self.search(full_domain)
                
                # If we find a match, stop traversal
                if matching_modules:
                    return True
                    
            except Exception as e:
                _logger.error(f"Error processing domain {domain}: {e}")
                
        return False
    
    def _check_module_exclusion(self, module, options):
        """
        Check if a module should be excluded from the graph based on exclude_domains.
        
        Args:
            module: The module record to check
            options: Dictionary of options with optional exclude_domains
            
        Returns:
            Boolean indicating if module should be excluded
        """
        # If no exclude domains, don't exclude
        if not options.get("exclude_domains"):
            return False
            
        # Check each domain in exclude_domains
        for domain in options.get("exclude_domains", []):
            # Ensure domain is a list
            if not isinstance(domain, list):
                continue
                
            try:
                # Create a domain with the current module ID
                full_domain = [("id", "=", module.id)] + domain
                
                # Search for modules matching the domain
                matching_modules = self.search(full_domain)
                
                # If we find a match, exclude the module
                if matching_modules:
                    return True
                    
            except Exception as e:
                _logger.error(f"Error processing domain {domain}: {e}")
                
        return False