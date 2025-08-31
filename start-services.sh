#!/bin/bash
# start-services.sh - Script to start both Node.js and Python services

# Check if RAG_ENABLED is set to true in /data/.env
RAG_ENABLED=$(grep -E "^RAG_ENABLED=" /data/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr '[:upper:]' '[:lower:]')

if [ "$RAG_ENABLED" = "true" ]; then
    echo "RAG_ENABLED is true - starting Python RAG service..."
    
    # Activate virtual environment for Python
    source /app/venv/bin/activate
    
    # Start the Python RAG service in the background
    echo "Starting Python RAG service..."
    python main.py --host 127.0.0.1 --port 8000 --initialize &
    PYTHON_PID=$!
    
    # Give it a moment to initialize
    sleep 2
    echo "Python RAG service started with PID: $PYTHON_PID"
    
    # Set environment variables for the Node.js service
    export RAG_SERVICE_URL="http://localhost:8000"
    export RAG_SERVICE_ENABLED="true"
else
    echo "RAG_ENABLED is not true (value: '$RAG_ENABLED') - skipping Python RAG service"
    
    # Set environment variables to indicate RAG is disabled
    export RAG_SERVICE_ENABLED="false"
fi

# Start the Node.js application
echo "Starting Node.js Paperless-AI service..."
pm2-runtime ecosystem.config.js

# If Node.js exits and Python service was started, kill it
if [ ! -z "$PYTHON_PID" ]; then
    echo "Stopping Python RAG service (PID: $PYTHON_PID)..."
    kill $PYTHON_PID
fi
