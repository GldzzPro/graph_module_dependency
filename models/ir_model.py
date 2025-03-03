from odoo import models


class Model(models.Model):
    _inherit = "ir.model"

    def get_model_relation_graph(self):
        """
        Generate a graph representation of model relations based on foreign keys.
        Returns a dictionary with nodes and edges similar to module dependency graph.
        """
        nodes = []
        edges = []
        
        for model in self:
            # Add current model as a node
            nodes.append({
                "id": model.id,
                "label": model.name,
                "model": model.model,
            })
            
            # Get all fields of this model that are relational
            relational_fields = self.env["ir.model.fields"].search([
                ("model_id", "=", model.id),
                ("ttype", "in", ["many2one", "one2many", "many2many"]),
            ])
            
            # Process each relational field
            for field in relational_fields:
                # Get the target model
                if field.relation:
                    target_model = self.env["ir.model"].search([("model", "=", field.relation)], limit=1)
                    if target_model:
                        # Add the target model as a node
                        nodes.append({
                            "id": target_model.id,
                            "label": target_model.name,
                            "model": target_model.model,
                        })
                        
                        # Add an edge between current model and target model
                        edges.append({
                            "from": model.id,
                            "to": target_model.id,
                            "field": field.name,
                            "type": field.ttype,
                        })
                        
                        # Recursively get related models (limiting depth to avoid infinite loops)
                        # Only follow many2one relationships to avoid excessive complexity
                        if field.ttype == "many2one":
                            res = target_model.get_model_relation_graph()
                            nodes.extend(res["nodes"])
                            edges.extend(res["edges"])
        
        # Ensure uniqueness of nodes and edges
        unique_nodes = list({node["id"]: node for node in nodes}.values())
        unique_edges = list(
            {"%s-%s" % (edge["from"], edge["to"]): edge for edge in edges}.values()
        )
        
        return {"nodes": unique_nodes, "edges": unique_edges}