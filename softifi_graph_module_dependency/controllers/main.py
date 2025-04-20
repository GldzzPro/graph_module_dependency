# -*- coding: utf-8 -*-
import json
from odoo import http
from odoo.http import request
import logging

_logger = logging.getLogger(__name__)

class ModuleGraphController(http.Controller):

    @http.route('/graph_module_dependency/module_graph', type='json', auth='public', methods=['POST'], csrf=False)
    def get_module_graph_route(self, module_ids, options=None):
        """
        Public route to get the dependency graph for given module IDs.
        :param list module_ids: List of integers representing module IDs.
        :param dict options: Optional dictionary for graph building options.
        :return: JSON representation of the module graph.
        """
        try:
            # Ensure module_ids is a list of integers
            if not isinstance(module_ids, list) or not all(isinstance(mid, int) for mid in module_ids):
                return {'error': 'Invalid input: module_ids must be a list of integers.'}

            options = options or {}
            graph_data = request.env['ir.module.module'].get_module_graph(module_ids, options=options)
            return graph_data
        except Exception as e:
            _logger.error("Error fetching module graph: %s", e, exc_info=True)
            return {'error': 'An error occurred while generating the module graph.'}

    @http.route('/graph_module_dependency/reverse_module_graph', type='json', auth='public', methods=['POST'], csrf=False)
    def get_reverse_dependency_graph_route(self, module_ids, options=None):
        """
        Public route to get the reverse dependency graph for given module IDs.
        :param list module_ids: List of integers representing module IDs.
        :param dict options: Optional dictionary for graph building options.
        :return: JSON representation of the reverse module graph.
        """
        try:
            # Ensure module_ids is a list of integers
            if not isinstance(module_ids, list) or not all(isinstance(mid, int) for mid in module_ids):
                return {'error': 'Invalid input: module_ids must be a list of integers.'}

            options = options or {}
            graph_data = request.env['ir.module.module'].get_reverse_dependency_graph(module_ids, options=options)
            return graph_data
        except Exception as e:
            _logger.error("Error fetching reverse dependency graph: %s", e, exc_info=True)
            return {'error': 'An error occurred while generating the reverse dependency graph.'}
