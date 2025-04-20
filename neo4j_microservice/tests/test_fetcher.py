# -*- coding: utf-8 -*-
import json
import pytest
import responses
from unittest.mock import patch

# Import the module to test
from fetcher import GraphFetcher


@pytest.fixture
def mock_config():
    """Mock configuration for testing."""
    with patch('fetcher.Config') as mock_config:
        mock_config.ODOO_HOST = 'http://test-odoo:8069'
        mock_config.MAX_RETRIES = 2
        mock_config.RETRY_DELAY = 0
        yield mock_config


@pytest.fixture
def fetcher():
    """Create a GraphFetcher instance for testing."""
    return GraphFetcher(
        host='http://test-odoo:8069',
        max_retries=2,
        retry_delay=0
    )


@responses.activate
def test_fetch_module_graph_success(fetcher):
    """Test successful module graph fetching."""
    # Mock response data
    mock_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "nodes": [
                {"id": 1, "name": "base", "state": "installed"},
                {"id": 2, "name": "web", "state": "installed"}
            ],
            "edges": [
                {"from": 2, "to": 1, "type": "dependency"}
            ]
        }
    }
    
    # Register mock response
    responses.add(
        responses.POST,
        'http://test-odoo:8069/api/graph/module',
        json=mock_response,
        status=200
    )
    
    # Call the method
    result = fetcher.fetch_module_graph([2], {"max_depth": 2})
    
    # Verify the result
    assert result is not None
    assert "nodes" in result
    assert "edges" in result
    assert len(result["nodes"]) == 2
    assert len(result["edges"]) == 1


@responses.activate
def test_fetch_module_graph_error(fetcher):
    """Test error handling in module graph fetching."""
    # Mock error response
    mock_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "error": {
            "code": 100,
            "message": "Module not found",
            "data": {}
        }
    }
    
    # Register mock response
    responses.add(
        responses.POST,
        'http://test-odoo:8069/api/graph/module',
        json=mock_response,
        status=200
    )
    
    # Call the method
    result = fetcher.fetch_module_graph([999], {})
    
    # Verify the result
    assert result is None


@responses.activate
def test_extract_graph_components(fetcher):
    """Test extraction of nodes and edges from graph data."""
    # Test data
    graph_data = {
        "nodes": [
            {"id": 1, "name": "base"},
            {"id": 2, "name": "web"}
        ],
        "edges": [
            {"from": 2, "to": 1}
        ]
    }
    
    # Call the method
    nodes, edges = fetcher.extract_graph_components(graph_data)
    
    # Verify the result
    assert len(nodes) == 2
    assert len(edges) == 1
    assert nodes[0]["id"] == 1
    assert edges[0]["from"] == 2