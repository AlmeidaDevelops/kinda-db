"""
Series JSON Manager - Backend Flask
Herramienta visual para gestionar series_es.json
"""

from flask import Flask, jsonify, request, send_from_directory, Response
import json
import os
import subprocess
import re
import sys

app = Flask(__name__, static_folder='static')

# Ruta al JSON de series
SERIES_JSON_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'series', 'series_es.json')


def load_series():
    """Carga el archivo JSON de series"""
    with open(SERIES_JSON_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_series(data):
    """Guarda el archivo JSON de series con las claves ordenadas (temporadas al final)"""
    key_order = ['id', 'title', 'original_title', 'studio', 'release_year', 'genres', 'values', 'synopsis', 'images', 'seasons']
    
    if 'series' in data:
        new_series_list = []
        for s in data['series']:
            ordered_s = {}
            # Agregar claves en el orden preferido
            for key in key_order:
                if key in s:
                    ordered_s[key] = s[key]
            # Agregar cualquier otra clave que no esté en la lista
            for key in s:
                if key not in ordered_s:
                    ordered_s[key] = s[key]
            new_series_list.append(ordered_s)
        data['series'] = new_series_list

    with open(SERIES_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def get_yt_dlp_path():
    """Busca la ruta de yt-dlp, priorizando el entorno virtual"""
    # Intentar buscar en la misma carpeta que el ejecutable de python (venv)
    venv_bin = os.path.dirname(sys.executable)
    local_yt_dlp = os.path.join(venv_bin, 'yt-dlp')
    if os.path.isfile(local_yt_dlp) and os.access(local_yt_dlp, os.X_OK):
        return local_yt_dlp
    return 'yt-dlp'  # Fallback al PATH del sistema


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


def get_youtube_data_stream(url, get_descriptions=False):
    """Generador que usa yt-dlp para extraer datos de YouTube con progreso"""
    yt_dl_cmd = get_yt_dlp_path()
    
    # 1. Obtener el conteo total primero (rápido)
    try:
        cmd_count = [yt_dl_cmd, '--flat-playlist', '--dump-single-json', url]
        result = subprocess.run(cmd_count, capture_output=True, text=True, timeout=30)
        playlist_info = json.loads(result.stdout)
        total_videos = playlist_info.get('playlist_count') or len(playlist_info.get('entries', []))
        yield json.dumps({'type': 'count', 'total': total_videos}) + '\n'
    except Exception as e:
        print(f"Error getting count: {e}")
        # Si falla el conteo, seguimos sin él

    # 2. Extraer videos uno a uno
    cmd = [
        yt_dl_cmd, '--dump-json', '--no-download',
        '--no-warnings', '--ignore-errors', url
    ]
    if not get_descriptions:
        cmd.append('--flat-playlist')

    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    videos = []
    for line in process.stdout:
        if line.strip():
            try:
                data = json.loads(line)
                video = {
                    'title': data.get('title', ''),
                    'id': data.get('id', ''),
                    'url': f"https://www.youtube.com/watch?v={data.get('id', '')}",
                    'duration': data.get('duration', 0),
                    'thumbnail': f"https://i.ytimg.com/vi/{data.get('id', '')}/hqdefault.jpg",
                    'description': data.get('description', '') if get_descriptions else ''
                }
                videos.append(video)
                yield json.dumps({'type': 'video', 'video': video, 'current': len(videos)}) + '\n'
            except json.JSONDecodeError:
                continue

    process.wait()
    yield json.dumps({'type': 'done', 'videos': videos}) + '\n'


def get_youtube_data(url, is_playlist=False, get_descriptions=False):
    """Usa yt-dlp para extraer datos de YouTube (Sincrónico)"""
    yt_dlp_cmd = get_yt_dlp_path()
    try:
        if is_playlist:
            # Reutilizamos el stream pero lo consumimos sincrónicamente
            videos = []
            for item in get_youtube_data_stream(url, get_descriptions):
                data = json.loads(item)
                if data['type'] == 'done':
                    return {'videos': data['videos']}
            return {'videos': []}
        else:
            # Extraer info del canal
            cmd = [
                yt_dlp_cmd, '--dump-single-json', '--playlist-items', '0',
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


@app.route('/api/import/playlist/stream', methods=['POST'])
def import_playlist_stream():
    """Importar videos de una playlist de YouTube con streaming de progreso"""
    url = request.json.get('url', '')
    get_descriptions = request.json.get('get_descriptions', False)
    
    if not url:
        return jsonify({'error': 'URL requerida'}), 400
    
    return Response(get_youtube_data_stream(url, get_descriptions), mimetype='application/x-ndjson')


@app.route('/api/import/video', methods=['POST'])
def import_single_video():
    """Importar datos de un solo video de YouTube"""
    url = request.json.get('url', '')
    
    if not url:
        return jsonify({'error': 'URL requerida'}), 400
    
    yt_dlp_cmd = get_yt_dlp_path()
    try:
        cmd = [
            yt_dlp_cmd, '--dump-single-json', '--no-download',
            '--no-warnings', url
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        data = json.loads(result.stdout)
        
        video_id = data.get('id', '')
        return jsonify({
            'title': data.get('title', ''),
            'id': video_id,
            'url': f"https://www.youtube.com/watch?v={video_id}",
            'duration': data.get('duration', 0),
            'thumbnail': f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            'description': data.get('description', '')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
