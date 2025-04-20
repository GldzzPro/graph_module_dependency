# Odoo Module Dependency Graph to Neo4j Microservice

This microservice fetches Odoo module dependency graphs via JSON-RPC and ingests them into Neo4j.

## Overview

The microservice consists of four main components:

1. `config.py` - Handles environment variable configuration
2. `fetcher.py` - Manages HTTP requests to the Odoo JSON-RPC API
3. `loader.py` - Handles Neo4j database operations
4. `app.py` - Orchestrates the entire process

## Setup

### Requirements

Install the required dependencies:

```bash
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file with the following variables:

```
# Odoo Configuration
ODOO_HOST=http://localhost:8069
MODULE_IDS=[333]
OPTIONS={"max_depth": 2}

# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

## Usage

Run the microservice:

```bash
python app.py
```

## Docker Deployment

Build the Docker image:

```bash
docker build -t odoo-neo4j-microservice .
```

Run the container:

```bash
docker run --env-file .env odoo-neo4j-microservice
```

## Testing

Run the tests:

```bash
python -m pytest
```