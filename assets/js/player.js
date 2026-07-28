/* Chandamama Audio Player — MP3 Download Player */
class ChandamamaPlayer {
  constructor() {
    this.audio = new Audio();
    this.currentEpisode = null;
    this.isPlaying = false;
    this.playerBar = null;
    this.init();
  }
  init() {
    if (!document.querySelector('.player-bar')) this.createPlayerBar();
    this.playerBar = document.querySelector('.player-bar');
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
    document.querySelectorAll('.btn-play-ep').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.episode-card');
        if (!card) return;
        this.play(card.dataset.audio, card.dataset.title, card.dataset.lang, card.querySelector('.episode-art')?.textContent || '🎧');
      });
    });
  }
  createPlayerBar() {
    const bar = document.createElement('div');
    bar.className = 'player-bar';
    bar.innerHTML = `
      <div class="player-art" id="playerArt">🎧</div>
      <div class="player-info">
        <div class="title" id="playerTitle">Select an episode</div>
        <div class="lang" id="playerLang">—</div>
      </div>
      <div class="player-controls">
        <button class="player-btn-sm" onclick="window.chandamamaPlayer.seek(-15)" title="-15s">⏪</button>
        <button class="player-btn-sm play" id="playerPlayBtn" onclick="window.chandamamaPlayer.togglePlay()" title="Play/Pause">▶️</button>
        <button class="player-btn-sm" onclick="window.chandamamaPlayer.seek(15)" title="+15s">⏩</button>
      </div>
      <div class="player-progress">
        <span class="player-time" id="playerCur">0:00</span>
        <input type="range" id="playerProgress" min="0" max="100" value="0" step="0.1">
        <span class="player-time" id="playerDur">0:00</span>
      </div>
      <button class="player-btn-sm" onclick="window.chandamamaPlayer.close()" title="Close">✕</button>
    `;
    document.body.appendChild(bar);
    document.getElementById('playerProgress').addEventListener('input', (e) => {
      if (this.audio.duration) this.audio.currentTime = (e.target.value / 100) * this.audio.duration;
    });
  }
  play(url, title, lang, art) {
    if (this.currentEpisode === url && this.audio.src) { this.togglePlay(); return; }
    this.currentEpisode = url; this.audio.src = url;
    this.audio.play().then(() => {
      this.isPlaying = true; this.playerBar.classList.add('active');
      document.getElementById('playerArt').textContent = art || '🎧';
      document.getElementById('playerTitle').textContent = title;
      document.getElementById('playerLang').textContent = lang || 'Audio';
      this.updatePlayButton();
    }).catch(err => { alert('Could not play audio. The file may not be available yet.'); });
  }
  togglePlay() {
    if (!this.audio.src) return;
    if (this.isPlaying) { this.audio.pause(); this.isPlaying = false; }
    else { this.audio.play(); this.isPlaying = true; }
    this.updatePlayButton();
  }
  updatePlayButton() {
    const btn = document.getElementById('playerPlayBtn');
    if (btn) btn.textContent = this.isPlaying ? '⏸️' : '▶️';
  }
  seek(seconds) { this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 0, this.audio.currentTime + seconds)); }
  updateProgress() {
    if (!this.audio.duration) return;
    const pct = (this.audio.currentTime / this.audio.duration) * 100;
    const progress = document.getElementById('playerProgress');
    if (progress) progress.value = pct;
    document.getElementById('playerCur').textContent = this.formatTime(this.audio.currentTime);
  }
  updateDuration() { document.getElementById('playerDur').textContent = this.formatTime(this.audio.duration); }
  onEnded() { this.isPlaying = false; this.updatePlayButton(); }
  close() { this.audio.pause(); this.isPlaying = false; this.playerBar.classList.remove('active'); this.currentEpisode = null; this.updatePlayButton(); }
  formatTime(seconds) { if (isNaN(seconds)) return '0:00'; const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return `${m}:${s.toString().padStart(2, '0')}`; }
}
document.addEventListener('DOMContentLoaded', () => { window.chandamamaPlayer = new ChandamamaPlayer(); });
