/**
 * Series JSON Manager - Frontend JavaScript
 */

let seriesData = { series: [] };
let currentSeries = null;
let currentEditEpisode = null;
let openSeasons = new Set();

// === Initialization ===

document.addEventListener('DOMContentLoaded', () => {
    loadSeriesData();
});

async function loadSeriesData() {
    try {
        const response = await fetch('/api/series');
        seriesData = await response.json();
        renderSeriesList();
        
        // Restore state from localStorage
        const savedSeriesId = localStorage.getItem('currentSeriesId');
        if (savedSeriesId) {
            const series = seriesData.series.find(s => s.id === savedSeriesId);
            if (series) {
                currentSeries = series;
                const savedOpenSeasons = localStorage.getItem(`openSeasons_${savedSeriesId}`);
                if (savedOpenSeasons) {
                    openSeasons = new Set(JSON.parse(savedOpenSeasons));
                }
                renderSeriesList();
                renderSeriesContent();
            }
        }
        
        showToast('Datos cargados correctamente');
    } catch (error) {
        showToast('Error al cargar datos: ' + error.message, true);
    }
}

// === Render Functions ===

function renderSeriesList() {
    const container = document.getElementById('seriesList');
    container.innerHTML = seriesData.series.map(series => `
        <div class="series-item ${currentSeries?.id === series.id ? 'active' : ''}" 
             onclick="selectSeries('${series.id}')">
            <img src="${series.images?.logo || 'https://via.placeholder.com/40'}" 
                 alt="${series.title}" 
                 onerror="this.src='https://via.placeholder.com/40'">
            <div class="series-item-info">
                <h3>${series.title}</h3>
                <span>${series.seasons?.length || 0} temporadas</span>
            </div>
        </div>
    `).join('');
    
    // Update target series dropdown
    const select = document.getElementById('targetSeries');
    select.innerHTML = '<option value="">-- Selecciona una serie --</option>' +
        seriesData.series.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
}

function selectSeries(seriesId) {
    currentSeries = seriesData.series.find(s => s.id === seriesId);
    
    // Manage state
    localStorage.setItem('currentSeriesId', seriesId);
    const savedOpenSeasons = localStorage.getItem(`openSeasons_${seriesId}`);
    openSeasons = savedOpenSeasons ? new Set(JSON.parse(savedOpenSeasons)) : new Set();
    
    renderSeriesList();
    renderSeriesContent();
}

function renderSeriesContent() {
    if (!currentSeries) {
        document.getElementById('mainContent').innerHTML = `
            <div class="empty-state">
                <h3>Selecciona una serie</h3>
                <p>O crea una nueva para comenzar</p>
            </div>
        `;
        return;
    }

    const content = document.getElementById('mainContent');
    content.innerHTML = `
        <!-- Series Header -->
        <div class="series-header">
            <img class="series-banner" 
                 src="${currentSeries.images?.banner || 'https://via.placeholder.com/1200x200?text=Banner'}" 
                 alt="Banner"
                 onerror="this.src='https://via.placeholder.com/1200x200?text=Banner'">
            <div class="series-header-content">
                <img class="series-logo" 
                     src="${currentSeries.images?.logo || 'https://via.placeholder.com/80'}" 
                     alt="Logo"
                     onerror="this.src='https://via.placeholder.com/80'">
                <div class="series-header-info">
                    <h2 contenteditable="true" 
                        class="editable" 
                        onblur="updateSeriesField('title', this.textContent)">${currentSeries.title}</h2>
                    <div class="meta">
                        <span>${currentSeries.studio || 'Estudio desconocido'}</span> • 
                        <span>${currentSeries.release_year || '????'}</span> •
                        <span>${currentSeries.genres?.join(', ') || 'Sin géneros'}</span>
                    </div>
                    ${currentSeries.values?.length ? `
                    <div class="value-tags" style="margin-top: 0.5rem;">
                        ${currentSeries.values.map(v => `<span class="value-tag">${v}</span>`).join('')}
                    </div>` : ''}
                </div>
            </div>
        </div>

        <!-- Synopsis -->
        <div style="margin-bottom: 2rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
            <h3 style="margin-bottom: 0.5rem;">Sinopsis</h3>
            <p contenteditable="true" 
               class="editable" 
               style="color: var(--text-secondary); line-height: 1.6;"
               onblur="updateSeriesField('synopsis', this.textContent)">${currentSeries.synopsis || 'Sin sinopsis...'}</p>
        </div>

        <!-- Seasons -->
        <div class="seasons-container">
            ${renderSeasons()}
        </div>

        <!-- Add Season Buttons -->
        <div class="add-season-buttons" style="margin-top: 1rem; display: flex; gap: 1rem; flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="openImportModal()">
                📥 Agregar desde Playlist
            </button>
            <button class="btn btn-secondary" onclick="openManualSeasonModal()">
                ✏️ Agregar Temporada Manual
            </button>
        </div>
    `;
}

function renderSeasons() {
    if (!currentSeries.seasons || currentSeries.seasons.length === 0) {
        return '<div class="empty-state"><p>No hay temporadas. Importa una playlist para agregar una.</p></div>';
    }

    return currentSeries.seasons.map((season, seasonIndex) => {
        const isOpen = openSeasons.has(seasonIndex);
        return `
            <div class="season ${isOpen ? 'open' : ''}" id="season-${seasonIndex}">
                <div class="season-header" onclick="toggleSeason(${seasonIndex})">
                    <h3>
                        <span contenteditable="true" 
                              class="editable"
                              onclick="event.stopPropagation()"
                              onblur="updateSeasonTitle(${seasonIndex}, this.textContent)">${season.title}</span>
                        <span class="episode-count">${season.episodes?.length || 0} episodios</span>
                    </h3>
                    <span class="chevron">▼</span>
                </div>
                <div class="episodes-list">
                    ${renderEpisodes(season.episodes, seasonIndex)}
                    <div class="season-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary btn-small" onclick="addManualEpisode(${seasonIndex})">
                            ➕ Agregar Episodio
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="cleanAllTitles(${seasonIndex})">
                            🧹 Limpiar todos los títulos
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderEpisodes(episodes, seasonIndex) {
    if (!episodes || episodes.length === 0) {
        return '<p style="color: var(--text-secondary);">No hay episodios</p>';
    }

    return episodes.map((episode, epIndex) => `
        <div class="episode">
            <div class="episode-order-controls">
                <button class="btn-icon btn-order" title="Subir" 
                        onclick="moveEpisode(${seasonIndex}, ${epIndex}, -1)"
                        ${epIndex === 0 ? 'disabled' : ''}>⬆️</button>
                <div class="episode-number">${episode.episode_number}</div>
                <button class="btn-icon btn-order" title="Bajar" 
                        onclick="moveEpisode(${seasonIndex}, ${epIndex}, 1)"
                        ${epIndex === episodes.length - 1 ? 'disabled' : ''}>⬇️</button>
            </div>
            <img class="episode-thumbnail" 
                 src="${episode.thumbnail || 'https://via.placeholder.com/120x68'}" 
                 alt="${episode.title}"
                 onerror="this.src='https://via.placeholder.com/120x68'">
            <div class="episode-info">
                <h4>${episode.title}</h4>
                <span class="duration">${episode.duration} min</span>
                <p class="episode-synopsis">${episode.synopsis || 'Sin sinopsis'}</p>
            </div>
            <div class="episode-actions">
                <button class="btn-icon" title="Editar" onclick="editEpisode(${seasonIndex}, ${epIndex})">✏️</button>
                <button class="btn-icon" title="Limpiar título" onclick="cleanEpisodeTitle(${seasonIndex}, ${epIndex})">🧹</button>
                <a href="${episode.sources?.[0]?.url || '#'}" target="_blank" class="btn-icon" title="Ver en YouTube">▶️</a>
                <button class="btn-icon" title="Eliminar" onclick="deleteEpisode(${seasonIndex}, ${epIndex})">🗑️</button>
            </div>
        </div>
    `).join('');
}

// === Interaction Functions ===

function toggleSeason(index) {
    const seasonEl = document.getElementById(`season-${index}`);
    const isOpen = seasonEl.classList.toggle('open');
    
    if (isOpen) {
        openSeasons.add(index);
    } else {
        openSeasons.delete(index);
    }
    
    // Save state
    if (currentSeries) {
        localStorage.setItem(`openSeasons_${currentSeries.id}`, JSON.stringify(Array.from(openSeasons)));
    }
}

function updateSeriesField(field, value) {
    if (!currentSeries) return;
    currentSeries[field] = value.trim();
    showToast(`${field} actualizado`);
}

function updateSeasonTitle(seasonIndex, value) {
    if (!currentSeries) return;
    currentSeries.seasons[seasonIndex].title = value.trim();
    showToast('Título de temporada actualizado');
}

// === Episode Editing ===

function editEpisode(seasonIndex, episodeIndex) {
    const episode = currentSeries.seasons[seasonIndex].episodes[episodeIndex];
    currentEditEpisode = { seasonIndex, episodeIndex, episode };
    
    // Load all fields
    document.getElementById('editEpisodeTitle').value = episode.title;
    document.getElementById('editEpisodeSynopsis').value = episode.synopsis || '';
    document.getElementById('editEpisodeDuration').value = episode.duration || 0;
    document.getElementById('editEpisodeThumbnail').value = episode.thumbnail || '';
    
    // Load YouTube URL if exists
    const youtubeUrl = episode.sources?.find(s => s.type === 'youtube')?.url || '';
    document.getElementById('editEpisodeYoutubeUrl').value = youtubeUrl;
    
    // Show thumbnail preview if exists
    updateThumbnailPreview(episode.thumbnail);
    
    openModal('editEpisodeModal');
}

function updateThumbnailPreview(url) {
    const container = document.getElementById('thumbnailPreviewContainer');
    const img = document.getElementById('thumbnailPreview');
    
    if (url) {
        img.src = url;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

async function fetchVideoData() {
    const url = document.getElementById('editEpisodeYoutubeUrl').value.trim();
    if (!url) {
        showToast('Ingresa una URL de YouTube', true);
        return;
    }
    
    const btn = document.getElementById('fetchVideoBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Extrayendo...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/import/video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        
        if (data.error) {
            showToast('Error: ' + data.error, true);
            return;
        }
        
        // Fill in all the fields
        document.getElementById('editEpisodeTitle').value = data.title || '';
        document.getElementById('editEpisodeDuration').value = Math.round((data.duration || 0) / 60);
        document.getElementById('editEpisodeThumbnail').value = data.thumbnail || '';
        document.getElementById('editEpisodeSynopsis').value = data.description || '';
        
        // Update thumbnail preview
        updateThumbnailPreview(data.thumbnail);
        
        // Store the video data for saving
        if (currentEditEpisode) {
            currentEditEpisode.videoData = data;
        }
        
        showToast('✅ Datos extraídos correctamente');
    } catch (error) {
        showToast('Error: ' + error.message, true);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Add event listener for thumbnail URL changes
document.addEventListener('DOMContentLoaded', () => {
    const thumbnailInput = document.getElementById('editEpisodeThumbnail');
    if (thumbnailInput) {
        thumbnailInput.addEventListener('input', (e) => {
            updateThumbnailPreview(e.target.value);
        });
    }
});

async function cleanCurrentTitle() {
    const input = document.getElementById('editEpisodeTitle');
    const cleaned = await cleanTitle(input.value);
    input.value = cleaned;
}

async function saveEpisodeEdit() {
    if (!currentEditEpisode) return;
    
    const { seasonIndex, episodeIndex, videoData } = currentEditEpisode;
    const episode = currentSeries.seasons[seasonIndex].episodes[episodeIndex];
    
    // Save all fields
    episode.title = document.getElementById('editEpisodeTitle').value;
    episode.synopsis = document.getElementById('editEpisodeSynopsis').value;
    episode.duration = parseInt(document.getElementById('editEpisodeDuration').value) || 0;
    episode.thumbnail = document.getElementById('editEpisodeThumbnail').value;
    
    // Handle YouTube source
    const youtubeUrl = document.getElementById('editEpisodeYoutubeUrl').value.trim();
    if (youtubeUrl) {
        // Extract video ID from URL or use videoData
        let videoId = videoData?.id || '';
        if (!videoId) {
            const match = youtubeUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            videoId = match ? match[1] : '';
        }
        
        // Update or add YouTube source
        if (!episode.sources) episode.sources = [];
        
        const youtubeSourceIndex = episode.sources.findIndex(s => s.type === 'youtube');
        const youtubeSource = {
            type: 'youtube',
            id: videoId,
            url: videoData?.url || youtubeUrl
        };
        
        if (youtubeSourceIndex >= 0) {
            episode.sources[youtubeSourceIndex] = youtubeSource;
        } else {
            episode.sources.push(youtubeSource);
        }
    }
    
    closeModal('editEpisodeModal');
    currentEditEpisode = null;
    renderSeriesContent();
    showToast('Episodio actualizado');
}

// === Title Cleaning ===

async function cleanTitle(text) {
    try {
        const response = await fetch('/api/clean-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: text })
        });
        const data = await response.json();
        return data.cleaned;
    } catch (error) {
        showToast('Error al limpiar título', true);
        return text;
    }
}

async function cleanEpisodeTitle(seasonIndex, episodeIndex) {
    const episode = currentSeries.seasons[seasonIndex].episodes[episodeIndex];
    episode.title = await cleanTitle(episode.title);
    renderSeriesContent();
    showToast('Título limpiado');
}

async function cleanAllTitles(seasonIndex) {
    const episodes = currentSeries.seasons[seasonIndex].episodes;
    showToast('Limpiando títulos...');
    
    for (let episode of episodes) {
        episode.title = await cleanTitle(episode.title);
    }
    
    renderSeriesContent();
    showToast(`${episodes.length} títulos limpiados`);
}

// === Import Functions ===

async function previewPlaylist() {
    const url = document.getElementById('playlistUrl').value;
    if (!url) {
        showToast('Ingresa una URL de playlist', true);
        return;
    }

    const preview = document.getElementById('importPreview');
    preview.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const response = await fetch('/api/import/playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();

        if (data.error) {
            preview.innerHTML = `<p style="color: var(--accent);">Error: ${data.error}</p>`;
            return;
        }

        preview.innerHTML = `
            <div style="max-height: 200px; overflow-y: auto; background: var(--bg-tertiary); padding: 1rem; border-radius: 8px;">
                <p><strong>${data.videos.length} videos encontrados</strong></p>
                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                    ${data.videos.slice(0, 10).map(v => `<li>${v.title}</li>`).join('')}
                    ${data.videos.length > 10 ? `<li>... y ${data.videos.length - 10} más</li>` : ''}
                </ul>
            </div>
        `;
    } catch (error) {
        preview.innerHTML = `<p style="color: var(--accent);">Error: ${error.message}</p>`;
    }
}

async function importPlaylist() {
    const url = document.getElementById('playlistUrl').value;
    const seriesId = document.getElementById('targetSeries').value;
    const seasonNumber = parseInt(document.getElementById('seasonNumber').value);
    const getDescriptions = document.getElementById('getDescriptions').checked;

    if (!url || !seriesId) {
        showToast('Completa todos los campos', true);
        return;
    }

    const progressContainer = document.getElementById('importProgress');
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    const preview = document.getElementById('importPreview');

    progressContainer.style.display = 'block';
    preview.style.display = 'none';
    progressBar.style.width = '0%';
    progressText.textContent = 'Iniciando conexión...';

    const videos = [];
    let totalVideos = 0;

    try {
        const response = await fetch('/api/import/playlist/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, get_descriptions: getDescriptions })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const data = JSON.parse(line);
                    if (data.type === 'count') {
                        totalVideos = data.total;
                        progressText.textContent = `Encontrados ${totalVideos} videos. Extrayendo datos...`;
                    } else if (data.type === 'video') {
                        videos.push(data.video);
                        const percent = totalVideos ? (videos.length / totalVideos) * 100 : 0;
                        progressBar.style.width = `${percent}%`;
                        progressText.textContent = `Importando video ${videos.length}${totalVideos ? ` de ${totalVideos}` : ''}: ${data.video.title}`;
                    } else if (data.type === 'done') {
                        // The final videos list is in data.videos
                        finalizeImport(seriesId, seasonNumber, data.videos, getDescriptions);
                        return;
                    }
                } catch (e) {
                    console.error('Error parsing streaming line:', e, line);
                }
            }
        }
    } catch (error) {
        showToast('Error en la importación: ' + error.message, true);
        progressContainer.style.display = 'none';
    }
}

function finalizeImport(seriesId, seasonNumber, videoData, getDescriptions) {
    // Find target series
    const targetSeries = seriesData.series.find(s => s.id === seriesId);
    if (!targetSeries) return;

    // Create new season
    const newSeason = {
        season_number: seasonNumber,
        title: `Temporada ${seasonNumber}`,
        episode_count: videoData.length,
        episodes: videoData.map((video, idx) => ({
            episode_number: idx + 1,
            title: video.title,
            duration: Math.round((video.duration || 0) / 60),
            thumbnail: video.thumbnail,
            sources: [{
                type: 'youtube',
                id: video.id,
                url: video.url
            }],
            synopsis: video.description || ''
        }))
    };

    if (!targetSeries.seasons) {
        targetSeries.seasons = [];
    }
    
    // Check if season already exists
    const existingIndex = targetSeries.seasons.findIndex(s => s.season_number === seasonNumber);
    if (existingIndex >= 0) {
        if (confirm(`La temporada ${seasonNumber} ya existe. ¿Deseas reemplazarla?`)) {
            targetSeries.seasons[existingIndex] = newSeason;
        } else {
            return;
        }
    } else {
        targetSeries.seasons.push(newSeason);
    }

    // Reset UI
    document.getElementById('importProgress').style.display = 'none';
    document.getElementById('importPreview').style.display = 'block';
    closeModal('importModal');
    selectSeries(seriesId);
    showToast(`Temporada importada: ${videoData.length} episodios${getDescriptions ? ' con sinopsis' : ''}`);
}

// === Channel Import ===

async function fetchChannelInfo() {
    const url = document.getElementById('channelUrl').value;
    if (!url) {
        showToast('Ingresa una URL de canal', true);
        return;
    }

    showToast('Obteniendo info del canal...');

    try {
        const response = await fetch('/api/import/channel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();

        if (data.error) {
            showToast('Error: ' + data.error, true);
            return;
        }

        // Fill form
        document.getElementById('newSeriesTitle').value = data.title || '';
        document.getElementById('newSeriesId').value = (data.title || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        showToast('Info obtenida correctamente');

    } catch (error) {
        showToast('Error: ' + error.message, true);
    }
}

// === Create New Series ===

function getSelectedValues() {
    const checkboxes = document.querySelectorAll('#valuesCheckboxes input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function getSelectedGenres() {
    const checkboxes = document.querySelectorAll('#genresCheckboxes input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function createNewSeries() {
    const selectedValues = getSelectedValues();
    const selectedGenres = getSelectedGenres();
    
    const newSeries = {
        id: document.getElementById('newSeriesId').value.trim(),
        title: document.getElementById('newSeriesTitle').value.trim(),
        original_title: document.getElementById('newSeriesTitle').value.trim(),
        studio: document.getElementById('newSeriesStudio').value.trim(),
        release_year: parseInt(document.getElementById('newSeriesYear').value) || new Date().getFullYear(),
        genres: selectedGenres.length > 0 ? selectedGenres : ['Animación'],
        values: selectedValues,
        synopsis: document.getElementById('newSeriesSynopsis').value.trim(),
        images: {
            banner: document.getElementById('newSeriesBanner').value.trim(),
            logo: document.getElementById('newSeriesLogo').value.trim()
        },
        seasons: []
    };

    if (!newSeries.id || !newSeries.title) {
        showToast('ID y Título son requeridos', true);
        return;
    }

    seriesData.series.push(newSeries);
    closeModal('newSeriesModal');
    renderSeriesList();
    selectSeries(newSeries.id);
    showToast('Serie creada correctamente');

    // Clear form
    ['newSeriesId', 'newSeriesTitle', 'newSeriesStudio', 'newSeriesYear', 'newSeriesSynopsis', 'newSeriesLogo', 'newSeriesBanner', 'channelUrl'].forEach(id => {
        document.getElementById(id).value = '';
    });
    // Clear checkboxes
    document.querySelectorAll('#valuesCheckboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('#genresCheckboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = cb.value === 'Animación'; // Reset to default
    });
}

// === Save ===

async function saveToFile() {
    try {
        const response = await fetch('/api/series', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(seriesData)
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ JSON guardado correctamente');
        } else {
            showToast('Error al guardar', true);
        }
    } catch (error) {
        showToast('Error: ' + error.message, true);
    }
}

// === Modal Functions ===

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// === Manual Season Functions ===

function openManualSeasonModal() {
    if (!currentSeries) {
        showToast('Selecciona una serie primero', true);
        return;
    }
    // Calculate next season number
    const nextSeason = (currentSeries.seasons?.length || 0) + 1;
    document.getElementById('manualSeasonNumber').value = nextSeason;
    document.getElementById('manualSeasonTitle').value = `Temporada ${nextSeason}`;
    openModal('manualSeasonModal');
}

function createManualSeason() {
    if (!currentSeries) return;
    
    const seasonNumber = parseInt(document.getElementById('manualSeasonNumber').value);
    const seasonTitle = document.getElementById('manualSeasonTitle').value.trim() || `Temporada ${seasonNumber}`;
    
    const newSeason = {
        season_number: seasonNumber,
        title: seasonTitle,
        episode_count: 0,
        episodes: []
    };
    
    if (!currentSeries.seasons) {
        currentSeries.seasons = [];
    }
    
    // Check if season already exists
    const existingIndex = currentSeries.seasons.findIndex(s => s.season_number === seasonNumber);
    if (existingIndex >= 0) {
        if (confirm(`La temporada ${seasonNumber} ya existe. ¿Deseas reemplazarla?`)) {
            currentSeries.seasons[existingIndex] = newSeason;
        } else {
            return;
        }
    } else {
        currentSeries.seasons.push(newSeason);
        // Sort seasons by number
        currentSeries.seasons.sort((a, b) => a.season_number - b.season_number);
    }
    
    closeModal('manualSeasonModal');
    renderSeriesContent();
    showToast(`Temporada ${seasonNumber} creada`);
}

// === Episode Ordering Functions ===

function moveEpisode(seasonIndex, episodeIndex, direction) {
    const episodes = currentSeries.seasons[seasonIndex].episodes;
    const newIndex = episodeIndex + direction;
    
    if (newIndex < 0 || newIndex >= episodes.length) return;
    
    // Swap episodes
    [episodes[episodeIndex], episodes[newIndex]] = [episodes[newIndex], episodes[episodeIndex]];
    
    // Update episode numbers
    renumberEpisodes(seasonIndex);
    
    renderSeriesContent();
    showToast('Episodio movido');
}

function renumberEpisodes(seasonIndex) {
    const episodes = currentSeries.seasons[seasonIndex].episodes;
    episodes.forEach((episode, index) => {
        episode.episode_number = index + 1;
    });
    // Update episode count
    currentSeries.seasons[seasonIndex].episode_count = episodes.length;
}

function addManualEpisode(seasonIndex) {
    const episodes = currentSeries.seasons[seasonIndex].episodes || [];
    const newEpisodeNumber = episodes.length + 1;
    
    const newEpisode = {
        episode_number: newEpisodeNumber,
        title: `Episodio ${newEpisodeNumber}`,
        duration: 0,
        thumbnail: 'https://via.placeholder.com/120x68?text=Nuevo',
        sources: [],
        synopsis: ''
    };
    
    if (!currentSeries.seasons[seasonIndex].episodes) {
        currentSeries.seasons[seasonIndex].episodes = [];
    }
    
    currentSeries.seasons[seasonIndex].episodes.push(newEpisode);
    currentSeries.seasons[seasonIndex].episode_count = currentSeries.seasons[seasonIndex].episodes.length;
    
    // Open edit modal for the new episode
    renderSeriesContent();
    editEpisode(seasonIndex, currentSeries.seasons[seasonIndex].episodes.length - 1);
    showToast('Episodio creado');
}

function deleteEpisode(seasonIndex, episodeIndex) {
    const episode = currentSeries.seasons[seasonIndex].episodes[episodeIndex];
    if (!confirm(`¿Eliminar el episodio "${episode.title}"?`)) return;
    
    currentSeries.seasons[seasonIndex].episodes.splice(episodeIndex, 1);
    renumberEpisodes(seasonIndex);
    
    renderSeriesContent();
    showToast('Episodio eliminado');
}

function openImportModal() {
    // Pre-select current series if one is selected
    if (currentSeries) {
        document.getElementById('targetSeries').value = currentSeries.id;
        // Calculate next season number
        const nextSeason = (currentSeries.seasons?.length || 0) + 1;
        document.getElementById('seasonNumber').value = nextSeason;
    }
    openModal('importModal');
}

function openNewSeriesModal() {
    openModal('newSeriesModal');
}

// === Toast Notifications ===

function showToast(message, isError = false) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// === Close modals on outside click ===

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
        }
    });
});
