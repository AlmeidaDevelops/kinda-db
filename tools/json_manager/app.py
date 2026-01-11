"""
Series JSON Manager - Backend Flask
Herramienta visual para gestionar series_es.json
"""

from flask import Flask, jsonify, request, send_from_directory
import json
import os
import subprocess
import re

app = Flask(__name__, static_folder='static')

# Ruta al JSON de series
SERIES_JSON_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'series', 'series_es.json')


def load_series():
    """Carga el archivo JSON de series"""
    with open(SERIES_JSON_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_series(data):
    """Guarda el archivo JSON de series"""
    with open(SERIES_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def clean_title(text):
    """Limpia un título: quita emojis, normaliza mayúsculas"""
    # Quitar emojis
    emoji_pattern = re.compile("["
        u"\U0001F600-\U0001F64F"  # emoticons
        u"\U0001F300-\U0001F5FF"  # symbols & pictographs
        u"\U0001F680-\U0001F6FF"  # transport & map symbols
        u"\U0001F1E0-\U0001F1FF"  # flags
        u"\U00002702-\U000027B0"
        u"\U000024C2-\U0001F251"
        u"\U0001f926-\U0001f937"
        u"\U00010000-\U0010ffff"
        u"\u2640-\u2642"
        u"\u2600-\u2B55"
        u"\u200d"
        u"\u23cf"
        u"\u23e9"
        u"\u231a"
        u"\ufe0f"
        u"\u3030"
        "]+", flags=re.UNICODE)
    
    text = emoji_pattern.sub('', text)
    
    # Quitar múltiples espacios
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Normalizar mayúsculas (Title Case)
    # Pero mantener acrónimos cortos en mayúsculas
    words = text.split()
    result = []
    for word in words:
        if len(word) <= 3 and word.isupper():
            result.append(word)  # Mantener acrónimos
        else:
            result.append(word.capitalize())
    
    return ' '.join(result)


def get_youtube_data(url, is_playlist=False, get_descriptions=False):
    """Usa yt-dlp para extraer datos de YouTube"""
    try:
        if is_playlist:
            if get_descriptions:
                # Extracción completa para obtener descripciones (más lento)
                cmd = [
                    'yt-dlp', '--dump-json', '--no-download',
                    '--no-warnings', '--ignore-errors', url
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                
                videos = []
                for line in result.stdout.strip().split('\n'):
                    if line:
                        try:
                            data = json.loads(line)
                            videos.append({
                                'title': data.get('title', ''),
                                'id': data.get('id', ''),
                                'url': f"https://www.youtube.com/watch?v={data.get('id', '')}",
                                'duration': data.get('duration', 0),
                                'thumbnail': f"https://i.ytimg.com/vi/{data.get('id', '')}/hqdefault.jpg",
                                'description': data.get('description', '')
                            })
                        except json.JSONDecodeError:
                            continue
                
                return {'videos': videos}
            else:
                # Extracción rápida sin descripciones
                cmd = [
                    'yt-dlp', '--flat-playlist', '-j',
                    '--no-warnings', url
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                
                videos = []
                for line in result.stdout.strip().split('\n'):
                    if line:
                        try:
                            data = json.loads(line)
                            videos.append({
                                'title': data.get('title', ''),
                                'id': data.get('id', ''),
                                'url': f"https://www.youtube.com/watch?v={data.get('id', '')}", 
                                'duration': data.get('duration', 0),
                                'thumbnail': f"https://i.ytimg.com/vi/{data.get('id', '')}/hqdefault.jpg",
                                'description': ''
                            })
                        except json.JSONDecodeError:
                            continue
                
                return {'videos': videos}
        else:
            # Extraer info del canal
            cmd = [
                'yt-dlp', '--dump-single-json', '--playlist-items', '0',
                '--no-warnings', url
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            data = json.loads(result.stdout)
            
            return {
                'title': data.get('channel', data.get('uploader', '')),
                'channel_id': data.get('channel_id', ''),
                'thumbnail': data.get('thumbnail', '')
            }
    except Exception as e:
        return {'error': str(e)}


# === API Routes ===

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/series', methods=['GET'])
def get_series():
    """Obtener todas las series"""
    return jsonify(load_series())


@app.route('/api/series', methods=['PUT'])
def update_series():
    """Actualizar todo el JSON de series"""
    data = request.json
    save_series(data)
    return jsonify({'success': True})


@app.route('/api/series/<series_id>', methods=['PUT'])
def update_single_series(series_id):
    """Actualizar una serie específica"""
    data = load_series()
    updated_series = request.json
    
    for i, series in enumerate(data['series']):
        if series['id'] == series_id:
            data['series'][i] = updated_series
            break
    
    save_series(data)
    return jsonify({'success': True})


@app.route('/api/clean-title', methods=['POST'])
def api_clean_title():
    """Limpiar un título"""
    text = request.json.get('title', '')
    return jsonify({'cleaned': clean_title(text)})


@app.route('/api/import/playlist', methods=['POST'])
def import_playlist():
    """Importar videos de una playlist de YouTube"""
    url = request.json.get('url', '')
    get_descriptions = request.json.get('get_descriptions', False)
    
    if not url:
        return jsonify({'error': 'URL requerida'}), 400
    
    result = get_youtube_data(url, is_playlist=True, get_descriptions=get_descriptions)
    return jsonify(result)


@app.route('/api/import/channel', methods=['POST'])
def import_channel():
    """Importar datos de un canal de YouTube"""
    url = request.json.get('url', '')
    
    if not url:
        return jsonify({'error': 'URL requerida'}), 400
    
    result = get_youtube_data(url, is_playlist=False)
    return jsonify(result)


if __name__ == '__main__':
    print("🎬 Series JSON Manager")
    print(f"📁 JSON: {os.path.abspath(SERIES_JSON_PATH)}")
    print("🌐 Abriendo en http://localhost:5000")
    app.run(debug=True, port=5000)
