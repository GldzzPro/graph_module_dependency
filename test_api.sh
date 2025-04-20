#!/bin/bash

# Test script for Module Graph API
# Configuration
BASE_URL="http://localhost:8069"
MODULE_ID=333
DB_NAME="odoo26"

# Color definitions
GREEN='\033[0;32m'    
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Module Graph API Endpoints${NC}"
echo "============================================"

# Test 1: Basic module graph request
echo -e "\n${GREEN}Test 1: Basic Module Graph Request${NC}"
echo -e "${CYAN}Endpoint: ${BASE_URL}/api/graph/module${NC}"
echo -e "${YELLOW}Payload: module_ids=[${MODULE_ID}], options={}${NC}"
curl -s -X POST "$BASE_URL/api/graph/module" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "module_ids": [333],
            "options": {}
        },
        "id": null
    }' | jq '.'
echo -e "${BLUE}-----------------------------------------------------${NC}"

# Test 2: Module graph with max depth 2
echo -e "\n${GREEN}Test 2: Module Graph with Max Depth 2${NC}"
echo -e "${CYAN}Endpoint: ${BASE_URL}/api/graph/module${NC}"
echo -e "${YELLOW}Payload: module_ids=[${MODULE_ID}], options={\"max_depth\": 2}${NC}"
curl -s -X POST "$BASE_URL/api/graph/module" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "module_ids": [333],
            "options": {
                "max_depth": 2
            }
        },
        "id": null
    }' | jq '.'
echo -e "${BLUE}-----------------------------------------------------${NC}"

# Test 3: Module graph with Stop Condition
echo -e "\n${GREEN}Test 3: Module Graph with Stop Condition${NC}"
echo -e "${CYAN}Endpoint: ${BASE_URL}/api/graph/module${NC}"
echo -e "${YELLOW}Payload: module_ids=[${MODULE_ID}], options={\"stop_conditions\": [[[\"category_id\",\"not in\",[52]]]]}${NC}"
curl -s -X POST "$BASE_URL/api/graph/module" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "module_ids": [333],
            "options": {
                "stop_conditions": [[["category_id", "not in", [52]]]]
            }
        },
        "id": null
    }' | jq '.'
echo -e "${BLUE}-----------------------------------------------------${NC}"

# Test 4: Reverse Module Graph
echo -e "\n${GREEN}Test 4: Reverse Module Graph${NC}"
echo -e "${CYAN}Endpoint: ${BASE_URL}/api/graph/reverse${NC}"
echo -e "${YELLOW}Payload: module_ids=[${MODULE_ID}], options={}${NC}"
curl -s -X POST "$BASE_URL/api/graph/reverse" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "module_ids": [333],
            "options": {}
        },
        "id": null
    }' | jq '.'
echo -e "${BLUE}-----------------------------------------------------${NC}"

echo -e "${GREEN}All tests completed successfully!${NC}"

# Note: This script requires 'jq' for JSON formatting.
# Install on macOS: brew install jq

