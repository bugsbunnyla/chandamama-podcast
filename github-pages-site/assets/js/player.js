/* ============================================
   Chandamama Podcast Player
   GitHub Pages — Free Audio Player
   ============================================ */

class ChandamamaPlayer {
    constructor() {
        this.audio = new Audio();
        this.currentEpisode = null;
        this.isPlaying = false;
        this.playerBar = null;
        this.progressBar = null;
        this.timeDisplay = null;

        this.init();
    }

    init() {
        // Create player bar if it doesn't exist
        if (!document.querySelector('.player-bar')) {
            this.createPlayerBar();
        }
        this.playerBar = document.querySelector('.player-bar');
        this.progressBar = document.querySelector('.player-bar input[type="range"]');
        this.timeDisplay = document.querySelector('.player-bar .player-time');

        // Bind events
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.onEnded());
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());

        // Bind play buttons
        document.querySelectorAll('.btn-play').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.episode-card');
                const audioUrl = card.dataset.audio;
                const title = card.dataset.title;
                const lang = card.dataset.lang;
                const art = card.querySelector('.episode-art').textContent;
                this.play(audioUrl, title, lang, art);
            });
        });

        // Bind transcript toggles
        document.querySelectorAll('.btn-transcript').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.episode-card');
                const transcript = card.querySelector('.transcript-panel');
                if (transcript) {
                    transcript.classList.toggle('active');
                    btn.textContent = transcript.classList.contains('active') 
                        ? '📄 Hide Transcript' 
                        : '📄 Transcript';
                }
            });
        });
    }

    createPlayerBar() {
        const bar = document.createElement('div');
        bar.className = 'player-bar';
        bar.innerHTML = `
            <div class="player-art">🎧</div>
            <div class="player-info">
                <div class="title">Select an episode</div>
                <div class="lang">—</div>
            </div>
            <div class="player-controls">
                <button class="player-btn" id="btn-rewind">⏮️</button>
                <button class="player-btn play-pause" id="btn-play">▶️</button>
                <button class="player-btn" id="btn-forward">⏭️</button>
            </div>
            <div class="player-progress">
                <span class="player-time">0:00</span>
                <input type="range" min="0" max="100" value="0" step="0.1">
                <span class="player-time">0:00</span>
            </div>
            <button class="player-close" id="btn-close">✕</button>
        `;
        document.body.appendChild(bar);

        // Bind player controls
        bar.querySelector('#btn-play').addEventListener('click', () => this.togglePlay());
        bar.querySelector('#btn-rewind').addEventListener('click', () => this.seek(-15));
        bar.querySelector('#btn-forward').addEventListener('click', () => this.seek(15));
        bar.querySelector('#btn-close').addEventListener('click', () => this.close());
        bar.querySelector('input[type="range"]').addEventListener('input', (e) => {
            const time = (e.target.value / 100) * this.audio.duration;
            this.audio.currentTime = time;
        });
    }

    play(url, title, lang, art) {
        // If same episode, toggle play/pause
        if (this.currentEpisode === url) {
            this.togglePlay();
            return;
        }

        this.currentEpisode = url;
        this.audio.src = url;
        this.audio.play();
        this.isPlaying = true;

        // Update UI
        this.playerBar.classList.add('active');
        this.playerBar.querySelector('.player-art').textContent = art || '🎧';
        this.playerBar.querySelector('.title').textContent = title;
        this.playerBar.querySelector('.lang').textContent = lang;
        this.updatePlayButton();

        // Update episode card buttons
        document.querySelectorAll('.btn-play').forEach(btn => {
            const card = btn.closest('.episode-card');
            if (card && card.dataset.audio === url) {
                btn.innerHTML = '⏸️ Pause';
            } else {
                btn.innerHTML = '▶️ Play';
            }
        });
    }

    togglePlay() {
        if (!this.audio.src) return;

        if (this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
        } else {
            this.audio.play();
            this.isPlaying = true;
        }
        this.updatePlayButton();
        this.updateCardButtons();
    }

    updatePlayButton() {
        const btn = document.querySelector('#btn-play');
        if (btn) btn.textContent = this.isPlaying ? '⏸️' : '▶️';
    }

    updateCardButtons() {
        document.querySelectorAll('.btn-play').forEach(btn => {
            const card = btn.closest('.episode-card');
            if (card && card.dataset.audio === this.currentEpisode) {
                btn.innerHTML = this.isPlaying ? '⏸️ Pause' : '▶️ Play';
            } else {
                btn.innerHTML = '▶️ Play';
            }
        });
    }

    seek(seconds) {
        this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + seconds));
    }

    updateProgress() {
        if (!this.progressBar || !this.audio.duration) return;
        const percent = (this.audio.currentTime / this.audio.duration) * 100;
        this.progressBar.value = percent;

        const times = this.playerBar.querySelectorAll('.player-time');
        if (times.length >= 2) {
            times[0].textContent = this.formatTime(this.audio.currentTime);
            times[1].textContent = this.formatTime(this.audio.duration);
        }
    }

    updateDuration() {
        const times = this.playerBar.querySelectorAll('.player-time');
        if (times.length >= 2) {
            times[1].textContent = this.formatTime(this.audio.duration);
        }
    }

    onEnded() {
        this.isPlaying = false;
        this.updatePlayButton();
        this.updateCardButtons();
    }

    close() {
        this.audio.pause();
        this.isPlaying = false;
        this.playerBar.classList.remove('active');
        this.currentEpisode = null;
        this.updateCardButtons();
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chandamamaPlayer = new ChandamamaPlayer();
});
