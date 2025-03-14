import requests
import json
from flask import Response
import os

# OpenRouter API endpoint
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

def proxy_openrouter_request(request, api_key):
    """
    Proxy the request to OpenRouter API
    
    Args:
        request: The Flask request object
        api_key: The OpenRouter API key to use
        
    Returns:
        The response from OpenRouter API
    """
    # Extract request data
    data = request.get_json()
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
        'HTTP-Referer': os.environ.get('APP_HOSTNAME', 'https://myapp.com'),
        'X-Title': os.environ.get('APP_TITLE', 'MyApp')
    }
    
    # Copy necessary headers from original request
    if 'User-Agent' in request.headers:
        headers['User-Agent'] = request.headers['User-Agent']
    
    # Log request summary (without sensitive content)
    model = data.get('model', 'unknown')
    print(f"Proxying request to OpenRouter: model={model}")
    
    try:
        # Forward the request to OpenRouter
        response = requests.post(
            OPENROUTER_API_URL,
            headers=headers,
            json=data,
            stream=True,
            timeout=120  # 2 minutes timeout
        )
        
        # Prepare response to return to client
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        response_headers = {
            name: value for name, value in response.raw.headers.items()
            if name.lower() not in excluded_headers
        }
        
        # Return the response as-is, preserving status code and headers
        return Response(
            response.content,
            response.status_code,
            response_headers
        )
        
    except requests.RequestException as e:
        print(f"Error proxying request to OpenRouter: {str(e)}")
        return {
            "error": True,
            "message": f"Failed to connect to OpenRouter API: {str(e)}"
        }, 502
