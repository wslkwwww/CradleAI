from flask import Flask, request, jsonify
from flask_cors import CORS
import jwt
import datetime
import os
from werkzeug.exceptions import HTTPException

from auth import register_user, validate_login
from openrouter_proxy import proxy_openrouter_request
from api_key_manager import get_api_key, initialize_api_key_pool

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_secret_key')
app.config['JWT_EXPIRATION_DELTA'] = datetime.timedelta(days=1)

# Initialize API key pool on startup
initialize_api_key_pool()

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or 'username' not in data or 'derived_key' not in data:
        return jsonify({'message': 'Missing username or derived key'}), 400
    
    username = data['username']
    derived_key = data['derived_key']
    
    success, message = register_user(username, derived_key)
    if success:
        return jsonify({'message': message}), 201
    else:
        return jsonify({'message': message}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'derived_key' not in data:
        return jsonify({'message': 'Missing username or derived key'}), 400
    
    username = data['username']
    derived_key = data['derived_key']
    
    success, user_id = validate_login(username, derived_key)
    if success:
        # Generate JWT token
        token_payload = {
            'user_id': user_id,
            'exp': datetime.datetime.utcnow() + app.config['JWT_EXPIRATION_DELTA']
        }
        token = jwt.encode(token_payload, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({
            'message': 'Login successful',
            'token': token
        }), 200
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/api/proxy/openrouter', methods=['POST'])
def proxy_openrouter():
    # Verify JWT token
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'message': 'Missing or invalid token'}), 401
    
    token = auth_header.split(' ')[1]
    try:
        # Decode and verify the JWT token
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user_id = payload['user_id']
        
        # Get an API key from the pool
        api_key = get_api_key()
        if not api_key:
            return jsonify({'message': 'No API keys available'}), 503
        
        # Proxy the request to OpenRouter
        return proxy_openrouter_request(request, api_key)
        
    except jwt.ExpiredSignatureError:
        return jsonify({'message': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'message': 'Invalid token'}), 401

@app.errorhandler(Exception)
def handle_error(e):
    code = 500
    if isinstance(e, HTTPException):
        code = e.code
    return jsonify({'message': str(e)}), code

if __name__ == '__main__':
    app.run(debug=os.environ.get('FLASK_DEBUG', 'True') == 'True', 
            host='0.0.0.0', 
            port=int(os.environ.get('PORT', 5000)))
