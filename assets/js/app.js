// ============================================
// Chandamama Podcast — app.js (FIXED TTS)
// Replaced dead Google TTS with Web Speech API
// ============================================

// ======================= TEXT SANITIZER =======================
class TextSanitizer {
  static cleanPDFText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\u0C00-\u0C7F\u0900-\u097Fa-zA-Z0-9.,!?;:'"\s\u0964\u0965\n-]/g, '')
      .trim();
  }

  static splitIntoSentences(text) {
    const pattern = /[^\u0964.!?\n]+[\u0964.!?\n]+|[^\u0964.!?\n]+$/g;
    const matches = text.match(pattern);
    return matches ? matches.map(s => s.trim()).filter(s => s.length > 0) : [text];
  }

  static chunkText(text, maxLen = 180) {
    const sentences = this.splitIntoSentences(text);
    const chunks = [];
    let current = '';
    for (const s of sentences) {
      const t = s.trim();
      if (!t) continue;
      if ((current + t).length > maxLen && current.length > 0) {
        chunks.push(current.trim());
        current = t;
      } else {
        current += (current ? ' ' : '') + t;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text.substring(0, maxLen)];
  }
}

// ======================= THEATER =======================
class Theater {
  constructor() {
    this.isPlaying = false;
    this.lang = 'te';
    this.voices = [];
    this.voicesReady = false;
    this.loadVoices();
  }

  loadVoices() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const check = () => {
      const v = synth.getVoices();
      if (v.length > 0) { this.voices = v; this.voicesReady = true; }
    };
    check();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = check;
    }
    setTimeout(() => { if (!this.voicesReady) { this.voices = synth.getVoices(); this.voicesReady = true; } }, 1500);
  }

  getBestVoice() {
    const v = this.voices;
    for (let i = 0; i < v.length; i++) if (v[i].lang === 'te-IN') return v[i];
    for (let i = 0; i < v.length; i++) if (v[i].lang && v[i].lang.startsWith('te')) return v[i];
    for (let i = 0; i < v.length; i++) if (v[i].lang && v[i].lang.startsWith('hi')) return v[i];
    for (let i = 0; i < v.length; i++) if (v[i].lang && !v[i].lang.startsWith('en')) return v[i];
    return v[0] || null;
  }

  async speakWithWebSpeech(text, lang) {
    return new Promise((resolve, reject) => {
      const synth = window.speechSynthesis;
      if (!synth) { reject(new Error('No TTS')); return; }
      synth.cancel();
      const chunks = TextSanitizer.chunkText(text, 180);
      const voice = this.getBestVoice();
      let idx = 0;

      const next = () => {
        if (idx >= chunks.length) { resolve(); return; }
        const u = new SpeechSynthesisUtterance(chunks[idx]);
        u.lang = lang === 'te' ? 'te-IN' : (lang === 'hi' ? 'hi-IN' : 'en-US');
        u.rate = 0.9; u.pitch = 1.0; u.volume = 1.0;
        if (voice) u.voice = voice;
        u.onend = () => { idx++; next(); };
        u.onerror = (e) => { console.warn('[TTS] chunk error:', e.error); idx++; next(); };
        synth.speak(u);
      };
      next();
    });
  }

  async speakWithGoogleTTS(text, lang) {
    console.log('[TTS] Using Web Speech API (Google endpoint is dead)');
    return await this.speakWithWebSpeech(text, lang);
  }

  async playGoogleTTSChunk(text, lang) {
    // Kept for backward compatibility of call sites
    return await this.speakWithWebSpeech(text, lang || this.lang);
  }

  async openTheater(story) {
    if (this.isPlaying) return;
    this.isPlaying = true;
    console.log('[Theater] Opening story:', story?.title);

    const app = document.getElementById('app');
    app.innerHTML = `
      <div id="theater" style="padding:20px;max-width:800px;margin:0 auto;font-family:Nunito,sans-serif;">
        <div id="theaterLine" style="font-size:1.4rem;line-height:1.8;color:#333;min-height:120px;
          background:#fff9f0;padding:24px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          🎬 Loading...
        </div>
        <div style="text-align:center;margin-top:20px;">
          <button id="stopBtn" style="padding:10px 24px;font-size:1rem;border:none;
            border-radius:8px;background:#d32f2f;color:#fff;cursor:pointer;">⏹ Stop</button>
        </div>
      </div>
    `;

    document.getElementById('stopBtn').onclick = () => {
      window.speechSynthesis.cancel();
      this.isPlaying = false;
      app.innerHTML = '';
    };

    const sentences = TextSanitizer.splitIntoSentences(story.text || story.content || '');
    const lineEl = document.getElementById('theaterLine');

    for (let i = 0; i < sentences.length && this.isPlaying; i++) {
      const sentence = sentences[i];
      lineEl.textContent = sentence;
      lineEl.style.opacity = '1';
      lineEl.style.transform = 'translateY(0)';

      await this.speakWithWebSpeech(sentence, this.lang);
      if (!this.isPlaying) break;

      await new Promise(r => setTimeout(r, 400));
      lineEl.style.opacity = '0.3';
    }

    if (this.isPlaying) {
      lineEl.textContent = '🎬 The End';
      lineEl.style.opacity = '1';
    }
    this.isPlaying = false;
  }
}

window.theater = new Theater();

// ======================= APP INIT =======================
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div style="text-align:center;padding:60px 20px;font-family:Nunito,sans-serif;">
      <h1 style="font-size:2.5rem;color:#d32f2f;margin-bottom:12px;">📖 Chandamama Podcast</h1>
      <p style="color:#666;font-size:1.1rem;margin-bottom:40px;">Upload a PDF to start listening</p>
      <input type="file" id="pdfInput" accept=".pdf" style="display:none">
      <button id="uploadBtn" style="padding:14px 36px;font-size:1.1rem;border:none;
        border-radius:12px;background:#1976d2;color:#fff;cursor:pointer;
        box-shadow:0 4px 12px rgba(25,118,210,0.3);">
        📤 Upload PDF
      </button>
      <p id="status" style="margin-top:24px;color:#888;font-size:0.95rem;"></p>
    </div>
  `;

  document.getElementById('uploadBtn').onclick = () => {
    document.getElementById('pdfInput').click();
  };

  document.getElementById('pdfInput').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = document.getElementById('status');
    status.textContent = 'Reading PDF...';

    try {
      const arrayBuffer = await file.arrayBuffer();
      const extractor = new PDFStoryExtractor();
      const pages = await extractor.loadPDF(arrayBuffer);
      const stories = extractor.detectStories(pages);

      if (stories.length === 0) {
        status.textContent = 'No stories found in PDF.';
        return;
      }

      // Show story list
      app.innerHTML = `
        <div style="padding:20px;max-width:800px;margin:0 auto;font-family:Nunito,sans-serif;">
          <h2 style="color:#333;margin-bottom:20px;">📚 Stories (${stories.length})</h2>
          <div id="storyList"></div>
        </div>
      `;

      const list = document.getElementById('storyList');
      stories.forEach((story, idx) => {
        const btn = document.createElement('button');
        btn.textContent = `${idx + 1}. ${story.title}`;
        btn.style.cssText = 'display:block;width:100%;padding:16px 20px;margin-bottom:12px;' +
          'font-size:1.05rem;text-align:left;border:1px solid #e0e0e0;border-radius:10px;' +
          'background:#fff;cursor:pointer;transition:all 0.2s;';
        btn.onmouseenter = () => btn.style.background = '#f5f5f5';
        btn.onmouseleave = () => btn.style.background = '#fff';
        btn.onclick = () => window.theater.openTheater(story);
        list.appendChild(btn);
      });
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      console.error(err);
    }
  };
});
