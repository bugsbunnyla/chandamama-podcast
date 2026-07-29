/* ============================================================
   Chandamama Podcast Theater — Fixed v2.2
   Fixes: partial translation (was filtering long sentences),
          illegible audio (no Telugu voice installed),
          chunk sizing, full-book translation
   ============================================================ */

const CONFIG = {
  translateApi: 'https://api.mymemory.translated.net/get',
  translateDelay: 1200,
  translateCacheKey: 'cm_translate_cache_v22',
  maxRetries: 3,
  maxChunkLength: 350,      // Conservative: 350 chars * 3 bytes (Devanagari) ≈ 1050 URL chars
  maxLineLength: 2000,      // Was 300 — killed full paragraphs. Now 2000.
  voices: {
    kidBoy:     { pitch: 1.45, rate: 1.15, label: '👦 Kid Boy' },
    kidGirl:    { pitch: 1.55, rate: 1.10, label: '👧 Kid Girl' },
    adultMale:  { pitch: 0.95, rate: 1.00, label: '👨 Adult Male' },
    adultFemale:{ pitch: 1.15, rate: 1.00, label: '👩 Adult Female' },
    elderMale:  { pitch: 0.75, rate: 0.88, label: '👴 Elder Male' },
    elderFemale:{ pitch: 0.88, rate: 0.90, label: '👵 Elder Female' },
    oldMale:    { pitch: 0.65, rate: 0.80, label: '🧓 Old Age Male' },
    oldFemale:  { pitch: 0.78, rate: 0.82, label: '👵 Old Age Female' },
    animal:     { pitch: 1.35, rate: 1.25, label: '🐾 Animal' },
    narrator:   { pitch: 1.00, rate: 0.95, label: '🌙 Narrator' }
  }
};

// ======================= TEXT SANITIZER (Fixed) =======================
class TextSanitizer {
  static cleanPDFText(text) {
    if (!text) return '';
    let t = String(text);

    // Remove obvious PDF artifacts but PRESERVE story text
    t = t.replace(/---\s*PAGE\s*\d+\s*---/gi, '\n');
    t = t.replace(/\b\d{5,}\s*[\-/]\s*\d{5,}\b/g, ' '); // Long number chains (ISBN)
    t = t.replace(/\bRs\.?\s*\d+[\.,]?\d*\b/gi, ' '); // Prices
    t = t.replace(/\b\d+\s*(?:€|\$|£|¥)\b/g, ' '); // Currency symbols
    t = t.replace(/[#@^*~+=|\\{}[\]_<>]{2,}/g, ' '); // Repeated junk symbols only
    t = t.replace(/\b\d{4,}\b/g, ' '); // Standalone long numbers

    // Keep lines that have meaningful text. Be PERMISSIVE.
    const lines = t.split(/\n+/);
    const cleanLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed.length < 4) return false;
      // Count letters (Devanagari, Telugu, Tamil, Kannada, Malayalam, Bengali, Latin)
      const letterPattern = /[\u0900-\u097F\u0C00-\u0C7F\u0B80-\u0BFF\u0D00-\u0D7F\u0980-\u09FF\u0A80-\u0AFFa-zA-Z]/g;
      const alphaCount = (trimmed.match(letterPattern) || []).length;
      const total = trimmed.length;
      const ratio = alphaCount / total;
      // Keep if >20% letters OR it's a short title-like line
      return ratio > 0.20 || (total < 60 && alphaCount > 5);
    });

    t = cleanLines.join('\n');
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/[.]{3,}/g, '…');
    return t;
  }

  static splitIntoSentences(text) {
    if (!text) return [];
    // Split on Devanagari danda (।), double danda (॥), and Latin sentence ends
    const sentences = text
      .replace(/([।\.!?])\s+/g, "$1\n")
      .split(/\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
    // DO NOT filter by maxLineLength here — that was killing long paragraphs
    return sentences;
  }

  static chunkForTranslation(text, maxLen = CONFIG.maxChunkLength) {
    if (!text) return [];
    if (text.length <= maxLen) return [text];
    const chunks = [];
    let current = '';
    const words = text.split(/\s+/);
    for (const word of words) {
      if ((current + ' ' + word).length > maxLen) {
        if (current) chunks.push(current.trim());
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) chunks.push(current.trim());
    // Safety: if any single word is longer than maxLen, force-split it
    return chunks.flatMap(c => {
      if (c.length <= maxLen) return [c];
      const forced = [];
      for (let i = 0; i < c.length; i += maxLen) {
        forced.push(c.substring(i, i + maxLen));
      }
      return forced;
    });
  }
}

// ======================= TRANSLATION CACHE (LRU, persistent) =======================
class TranslationCache {
  constructor(maxSize = 5000, maxAgeDays = 30) {
    this.key = 'cm_translate_cache_v23';
    this.metaKey = 'cm_translate_cache_meta_v23';
    this.maxSize = maxSize;
    this.maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    this.data = this.load();
    this.meta = this.loadMeta();
  }
  hash(text, source, target) {
    let h = 5381;
    const str = String(text) + '|' + source + '|' + target;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) + str.charCodeAt(i);
      h |= 0;
    }
    return 't_' + Math.abs(h).toString(36);
  }
  get(text, source, target) {
    const key = this.hash(text, source, target);
    const entry = this.data[key];
    if (!entry) return null;
    if (Date.now() - entry.t > this.maxAge) {
      delete this.data[key]; delete this.meta[key];
      return null;
    }
    this.meta[key] = Date.now();
    return entry.v;
  }
  set(text, source, target, value) {
    const key = this.hash(text, source, target);
    const keys = Object.keys(this.data);
    if (keys.length >= this.maxSize) {
      let oldest = keys[0], oldestTime = this.meta[oldest] || 0;
      for (const k of keys) {
        const t = this.meta[k] || 0;
        if (t < oldestTime) { oldestTime = t; oldest = k; }
      }
      delete this.data[oldest]; delete this.meta[oldest];
    }
    this.data[key] = { v: value, t: Date.now() };
    this.meta[key] = Date.now();
    this.save();
  }
  load() { try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch(e) { return {}; } }
  loadMeta() { try { return JSON.parse(localStorage.getItem(this.metaKey) || '{}'); } catch(e) { return {}; } }
  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
      localStorage.setItem(this.metaKey, JSON.stringify(this.meta));
    } catch(e) { this.evictHalf(); }
  }
  evictHalf() {
    const keys = Object.keys(this.data);
    keys.sort((a, b) => (this.meta[a] || 0) - (this.meta[b] || 0));
    for (let i = 0; i < keys.length / 2; i++) {
      delete this.data[keys[i]]; delete this.meta[keys[i]];
    }
    this.save();
  }
  size() { return Object.keys(this.data).length; }
  clear() { this.data = {}; this.meta = {}; this.save(); }
}

// ======================= TRANSLATION PROVIDERS =======================

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class GoogleTranslateFreeProvider {
  constructor() {
    this.name = 'GoogleTranslateFree';
    this.failures = 0;
    this.circuitOpen = false;
    this.circuitResetAt = 0;
    this.minDelay = 800;
    this.lastRequestAt = 0;
    this.maxRetries = 3;
  }

  async translate(text, targetLang, sourceLang) {
    if (this.circuitOpen && Date.now() < this.circuitResetAt) throw new Error('Circuit breaker open');
    this.circuitOpen = false;
    const sl = sourceLang === 'Autodetect' ? 'auto' : sourceLang;
    const q = encodeURIComponent(text.substring(0, 1800));
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLang}&dt=t&q=${q}`;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const elapsed = Date.now() - this.lastRequestAt;
      const wait = this.minDelay * (attempt + 1) + Math.random() * 400;
      if (elapsed < wait) await sleep(wait - elapsed);
      try {
        this.lastRequestAt = Date.now();
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!data || !Array.isArray(data[0]) || data[0].length === 0) throw new Error('Empty response');
        const result = data[0].map(item => item[0]).join('');
        if (!result || result === text) throw new Error('Same text returned');
        this.failures = 0;
        return result;
      } catch (e) {
        console.warn(`[GoogleTranslateFree] Attempt ${attempt + 1} failed:`, e.message);
        if (attempt === this.maxRetries - 1) {
          this.failures++;
          if (this.failures >= 6) { this.circuitOpen = true; this.circuitResetAt = Date.now() + 3 * 60 * 1000; }
          throw e;
        }
      }
    }
  }
}

class LingvaProvider {
  constructor() {
    this.name = 'Lingva';
    this.failures = 0;
    this.circuitOpen = false;
    this.circuitResetAt = 0;
    this.minDelay = 1000;
    this.lastRequestAt = 0;
    this.maxRetries = 2;
  }

  async translate(text, targetLang, sourceLang) {
    if (this.circuitOpen && Date.now() < this.circuitResetAt) throw new Error('Circuit breaker open');
    this.circuitOpen = false;
    const sl = sourceLang === 'Autodetect' ? 'auto' : sourceLang;
    const q = encodeURIComponent(text.substring(0, 1200));
    const url = `https://lingva.ml/api/v1/${sl}/${targetLang}/${q}`;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const elapsed = Date.now() - this.lastRequestAt;
      const wait = this.minDelay * (attempt + 1) + Math.random() * 300;
      if (elapsed < wait) await sleep(wait - elapsed);
      try {
        this.lastRequestAt = Date.now();
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!data || !data.translation) throw new Error('Empty response');
        if (data.translation === text) throw new Error('Same text returned');
        this.failures = 0;
        return data.translation;
      } catch (e) {
        console.warn(`[Lingva] Attempt ${attempt + 1} failed:`, e.message);
        if (attempt === this.maxRetries - 1) {
          this.failures++;
          if (this.failures >= 5) { this.circuitOpen = true; this.circuitResetAt = Date.now() + 4 * 60 * 1000; }
          throw e;
        }
      }
    }
  }
}

class MyMemoryProvider {
  constructor() {
    this.name = 'MyMemory';
    this.failures = 0;
    this.circuitOpen = false;
    this.circuitResetAt = 0;
    this.minDelay = 12000;
    this.lastRequestAt = 0;
    this.email = 'user@example.com';
  }

  async translate(text, targetLang, sourceLang) {
    if (this.circuitOpen && Date.now() < this.circuitResetAt) throw new Error('Circuit breaker open');
    this.circuitOpen = false;
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minDelay) await sleep(this.minDelay - elapsed);
    const sl = sourceLang === 'Autodetect' ? 'Autodetect' : sourceLang;
    const q = encodeURIComponent(text.substring(0, 300));
    const url = `https://api.mymemory.translated.net/get?q=${q}&langpair=${sl}|${targetLang}&de=${encodeURIComponent(this.email)}`;
    try {
      this.lastRequestAt = Date.now();
      const resp = await fetch(url);
      if (resp.status === 429) throw new Error('429');
      const data = await resp.json();
      if (data.responseData?.translatedText) {
        const t = data.responseData.translatedText;
        if (t && t !== text) { this.failures = 0; return t; }
        throw new Error('Same text returned');
      }
      throw new Error(data.responseDetails || 'Empty');
    } catch (e) {
      this.failures++;
      if (this.failures >= 3) { this.circuitOpen = true; this.circuitResetAt = Date.now() + 10 * 60 * 1000; }
      throw e;
    }
  }
}

class LibreTranslateProvider {
  constructor() {
    this.name = 'LibreTranslate';
    this.mirrors = [
      'https://libretranslate.de',
      'https://translate.argosopentech.com',
      'https://libretranslate.pussthecat.org',
      'https://lt.vern.cc',
      'https://libretranslate.eownerdead.dedyn.io'
    ];
    this.mirrorIndex = 0;
    this.failures = 0;
    this.circuitOpen = false;
    this.circuitResetAt = 0;
    this.minDelay = 6000;
    this.lastRequestAt = 0;
  }
  get baseUrl() { return this.mirrors[this.mirrorIndex]; }

  async translate(text, targetLang, sourceLang) {
    if (this.circuitOpen && Date.now() < this.circuitResetAt) throw new Error('Circuit breaker open');
    this.circuitOpen = false;
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minDelay) await sleep(this.minDelay - elapsed + Math.random() * 1000);
    const url = `${this.baseUrl}/translate`;
    const body = { q: text.substring(0, 800), source: sourceLang === 'Autodetect' ? 'auto' : sourceLang, target: targetLang, format: 'text' };
    try {
      this.lastRequestAt = Date.now();
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      });
      if (resp.status === 429) { this.failures++; this.rotateMirror(); throw new Error('429'); }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      if (!data.translatedText || data.translatedText === text) throw new Error('Same text returned');
      this.failures = 0;
      return data.translatedText;
    } catch (e) {
      this.failures++;
      if (this.failures >= 5) { this.circuitOpen = true; this.circuitResetAt = Date.now() + 5 * 60 * 1000; }
      throw e;
    }
  }

  rotateMirror() {
    this.mirrorIndex = (this.mirrorIndex + 1) % this.mirrors.length;
    this.failures = Math.max(0, this.failures - 2);
    console.log(`[LibreTranslate] Rotated to: ${this.baseUrl}`);
  }
}

class UserKeyProvider {
  constructor(type) {
    this.type = type;
    this.name = { google: 'Google Cloud', deepl: 'DeepL', azure: 'Azure Translator' }[type] || type;
    this.failures = 0;
    this.minDelay = 50;
    this.lastRequestAt = 0;
  }
  getKey() { try { return localStorage.getItem(`cm_api_key_${this.type}`) || ''; } catch(e) { return ''; } }
  hasKey() { return !!this.getKey(); }

  async translate(text, targetLang, sourceLang) {
    const key = this.getKey();
    if (!key) throw new Error('No API key');
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minDelay) await sleep(this.minDelay - elapsed);
    this.lastRequestAt = Date.now();
    if (this.type === 'google') return this.translateGoogle(text, targetLang, sourceLang, key);
    if (this.type === 'deepl') return this.translateDeepL(text, targetLang, sourceLang, key);
    if (this.type === 'azure') return this.translateAzure(text, targetLang, sourceLang, key);
    throw new Error('Unknown provider');
  }

  async translateGoogle(text, targetLang, sourceLang, key) {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${key}`;
    const body = { q: text, target: targetLang, format: 'text' };
    if (sourceLang !== 'Autodetect') body.source = sourceLang;
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(`Google HTTP ${resp.status}`);
    const data = await resp.json();
    return data.data.translations[0].translatedText;
  }

  async translateDeepL(text, targetLang, sourceLang, key) {
    const isFree = key.endsWith(':fx');
    const url = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
    const body = new URLSearchParams({ text: text, target_lang: targetLang.toUpperCase() });
    if (sourceLang !== 'Autodetect') body.append('source_lang', sourceLang.toUpperCase());
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!resp.ok) throw new Error(`DeepL HTTP ${resp.status}`);
    const data = await resp.json();
    return data.translations[0].text;
  }

  async translateAzure(text, targetLang, sourceLang, key) {
    const region = localStorage.getItem('cm_api_key_azure_region') || 'global';
    let url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLang}`;
    if (sourceLang !== 'Autodetect') url += `&from=${sourceLang}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ Text: text }])
    });
    if (!resp.ok) throw new Error(`Azure HTTP ${resp.status}`);
    const data = await resp.json();
    return data[0].translations[0].text;
  }
}

// ======================= TRANSLATION MANAGER =======================

class TranslationManager {
  constructor() {
    this.cache = new TranslationCache();
    this.stats = { translated: 0, cached: 0, failed: 0 };
    this.providers = [
      new GoogleTranslateFreeProvider(),
      new LingvaProvider(),
      new MyMemoryProvider(),
      new LibreTranslateProvider(),
      new UserKeyProvider('google'),
      new UserKeyProvider('deepl'),
      new UserKeyProvider('azure')
    ];
    this.abortController = new AbortController();
  }

  get activeProviders() {
    return this.providers.filter(p => {
      if (p instanceof UserKeyProvider) return p.hasKey();
      return !(p.circuitOpen && Date.now() < p.circuitResetAt);
    });
  }

  get providerStatus() {
    return this.getStatus();
  }

  get bestProvider() {
    const free = this.activeProviders.find(p => !(p instanceof UserKeyProvider));
    return free || this.activeProviders[0] || null;
  }

  getStatus() {
    return this.providers.map(p => ({
      name: p.name,
      available: p instanceof UserKeyProvider ? p.hasKey() : !p.circuitOpen,
      circuitOpen: p.circuitOpen || false,
      failures: p.failures || 0
    }));
  }

  async translate(text, targetLang = 'te', sourceLang = 'Autodetect') {
    if (!text || !text.trim()) return '';
    const cached = this.cache.get(text, sourceLang, targetLang);
    if (cached !== null) { this.stats.cached++; return cached; }

    const clean = TextSanitizer.cleanPDFText(text);
    const chunks = TextSanitizer.chunkForTranslation(clean, 400);
    const results = [];

    for (const chunk of chunks) {
      if (this.abortController.signal.aborted) throw new Error('Translation cancelled');
      const cc = this.cache.get(chunk, sourceLang, targetLang);
      if (cc !== null) { this.stats.cached++; results.push(cc); continue; }

      let translated = null, lastError = null;
      for (const provider of this.activeProviders) {
        try {
          translated = await provider.translate(chunk, targetLang, sourceLang);
          if (translated && translated !== chunk) {
            this.stats.translated++;
            break;
          }
          throw new Error('Returned same text');
        } catch (e) {
          lastError = e.message;
          console.warn(`[Translate] ${provider.name} failed:`, e.message);
        }
      }

      if (translated === null || translated === chunk) {
        console.warn('[Translate] All providers failed. Using original. Last error:', lastError);
        this.stats.failed++;
        translated = chunk;
      }
      this.cache.set(chunk, sourceLang, targetLang, translated);
      results.push(translated);
    }

    const result = results.join(' ');
    this.cache.set(text, sourceLang, targetLang, result);
    return result;
  }

  async translateBatch(lines, targetLang = 'te', sourceLang = 'Autodetect', onProgress = null) {
    const results = [];
    let cachedCount = 0;
    for (const line of lines) {
      if (this.cache.get(line, sourceLang, targetLang) !== null) cachedCount++;
    }
    const networkTotal = lines.length - cachedCount;
    let networkDone = 0;

    for (let i = 0; i < lines.length; i++) {
      if (this.abortController.signal.aborted) throw new Error('Translation cancelled');
      const r = await this.translate(lines[i], targetLang, sourceLang);
      results.push(r);
      const wasCached = this.cache.get(lines[i], sourceLang, targetLang) === r && cachedCount > 0;
      if (!wasCached) networkDone++;
      if (onProgress) onProgress(i + 1, lines.length, networkDone, networkTotal);
    }
    return results;
  }

  cancel() {
    this.abortController.abort();
    this.abortController = new AbortController();
  }

  clearCache() {
    this.cache.clear();
    this.stats = { translated: 0, cached: 0, failed: 0 };
  }

  getCacheStats() {
    return { size: this.cache.size(), ...this.stats };
  }
}

const Translator = new TranslationManager();

// ======================= THEATER / AUDIO PLAYER =======================

class VoiceMapper {
  constructor() {
    this.map = {};
    this.emojiMap = {
      narrator: '🌙', hero: '⚔️', heroine: '✨', villain: '🐍',
      king: '👑', queen: '👸', sage: '📿', child: '🧒',
      demon: '👹', guard: '🛡️', farmer: '🌾', merchant: '💰',
      woman: '👩', man: '👨', bird: '🐦', animal: '🐾'
    };
  }
  autoAssign(chars) {
    chars.forEach((c, i) => {
      if (!this.map[c]) {
        const types = Object.keys(this.emojiMap);
        const type = types[i % types.length];
        this.map[c] = { type, emoji: this.emojiMap[type] };
      }
    });
  }
  assign(name, type) {
    this.map[name] = { type, emoji: this.emojiMap[type] || '👤' };
  }
}

class Theater {
  constructor() {
    this.voiceMapper = new VoiceMapper();
    this.script = null;
    this.lang = 'en';
    this.isPlaying = false;
    this.currentIndex = 0;
    this.voices = [];
    this.loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  loadVoices() {
    this.voices = speechSynthesis.getVoices() || [];
  }

  getVoiceForLang(lang) {
    this.loadVoices();
    const langCode = lang.toLowerCase();
    let v = this.voices.find(vx => vx.lang.toLowerCase().startsWith(langCode));
    if (!v && langCode === 'te') v = this.voices.find(vx => vx.lang.toLowerCase().startsWith('hi'));
    if (!v && langCode === 'te') v = this.voices.find(vx => vx.lang.toLowerCase().startsWith('ta'));
    if (!v) v = this.voices.find(vx => vx.lang.toLowerCase().startsWith('en'));
    return v || null;
  }

  loadScript(script, lang) {
    this.script = script;
    this.lang = lang;
    this.currentIndex = 0;
  }

  open() {
    console.log('[Theater] Opening');
  }

  stop() {
    this.isPlaying = false;
    speechSynthesis.cancel();
  }

  async play() {
    if (!this.script || !this.script.lines || this.script.lines.length === 0) {
      alert('No script loaded. Please select a story and translate first.');
      return;
    }
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentIndex = 0;

    const voice = this.getVoiceForLang(this.lang);
    const lines = this.script.lines;

    let overlay = document.getElementById('theaterOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'theaterOverlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(180deg,#0f0c29,#302b63,#24243e);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Nunito,sans-serif;color:#fff;overflow:hidden;';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div style="position:absolute;top:20px;right:20px;cursor:pointer;font-size:28px;z-index:10000;" onclick="window.theater.stop();document.getElementById('theaterOverlay').style.display='none';">✕</div>
      <div style="position:absolute;top:20px;left:20px;font-size:14px;color:#c4b5fd;">🎭 Chandamama Theater — ${this.lang.toUpperCase()}</div>
      <div id="theaterStage" style="text-align:center;max-width:800px;padding:40px;transition:all 0.4s ease;">
        <div id="theaterEmoji" style="font-size:64px;margin-bottom:20px;opacity:0;transform:scale(0.5);transition:all 0.4s ease;">🌙</div>
        <div id="theaterSpeaker" style="font-size:18px;color:#fbbf24;margin-bottom:12px;letter-spacing:1px;text-transform:uppercase;opacity:0;transition:opacity 0.3s;">Narrator</div>
        <div id="theaterLine" style="font-size:28px;line-height:1.6;font-weight:600;opacity:0;transform:translateY(10px);transition:all 0.4s ease;"></div>
      </div>
      <div style="position:absolute;bottom:30px;display:flex;gap:20px;">
        <button onclick="window.theater.stop();document.getElementById('theaterOverlay').style.display='none';" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:10px 24px;border-radius:20px;cursor:pointer;font-family:Nunito;">⏹ Stop</button>
      </div>
    `;

    for (let i = 0; i < lines.length && this.isPlaying; i++) {
      this.currentIndex = i;
      const line = lines[i];
      const text = line.translated || line.text;
      const speaker = line.speaker || 'Narrator';
      const vm = this.voiceMapper.map[speaker] || { emoji: '🌙', type: 'narrator' };

      const emojiEl = document.getElementById('theaterEmoji');
      const speakerEl = document.getElementById('theaterSpeaker');
      const lineEl = document.getElementById('theaterLine');

      if (emojiEl) { emojiEl.textContent = vm.emoji; emojiEl.style.opacity = '1'; emojiEl.style.transform = 'scale(1)'; }
      if (speakerEl) { speakerEl.textContent = speaker; speakerEl.style.opacity = '1'; }
      if (lineEl) { lineEl.textContent = text; lineEl.style.opacity = '1'; lineEl.style.transform = 'translateY(0)'; }

      if (text && voice) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.voice = voice;
        utter.lang = voice.lang;
        utter.rate = 0.9;
        utter.pitch = vm.type === 'child' ? 1.3 : vm.type === 'demon' ? 0.7 : 1.0;
        speechSynthesis.speak(utter);
        await new Promise(r => { utter.onend = r; utter.onerror = r; });
      } else if (text) {
        await sleep(2500);
      }

      if (lineEl) { lineEl.style.opacity = '0'; lineEl.style.transform = 'translateY(-10px)'; }
      if (emojiEl) { emojiEl.style.opacity = '0.3'; }
      await sleep(500);
    }

    this.isPlaying = false;
    const lineEl = document.getElementById('theaterLine');
    if (lineEl) lineEl.textContent = '🎬 The End';
  }
}

window.theater = new Theater();

// ======================= PDF PROCESSOR =======================
class ChandamamaApp {
  constructor() {
    this.lang = 'te';
    this.pages = [];
    this.stories = [];
    this.currentStory = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.renderLanguageCards();
    this.setLanguage('te');
    this.renderSettings();
    this.renderSettingsButton();
  }

  bindEvents() {
    const pdfInput = document.getElementById('pdfInput');
    if (pdfInput) pdfInput.addEventListener('change', (e) => this.handlePDF(e.target.files[0]));
    const dropZone = document.getElementById('pdfDropZone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) this.handlePDF(e.dataTransfer.files[0]);
      });
    }
  }

  renderLanguageCards() {
    const grid = document.getElementById('langGrid');
    if (!grid) return;
    const langs = [
      { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
      { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
      { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
      { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
      { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
      { code: 'ml', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
      { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
      { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्', flag: '🕉️' }
    ];
    grid.innerHTML = langs.map(l => `
      <div class="lang-card" data-lang="${l.code}" onclick="app.setLanguage('${l.code}')">
        <span class="flag">${l.flag}</span>
        <span class="lang-name">${l.name}</span>
        <span class="lang-native">${l.native}</span>
      </div>
    `).join('');
  }

  setLanguage(code) {
    this.lang = code;
    document.querySelectorAll('.lang-card').forEach(c => {
      c.classList.toggle('active', c.dataset.lang === code);
    });
    const label = document.getElementById('currentLangLabel');
    if (label) label.textContent = 'Target: ' + code.toUpperCase();
  }

  async handlePDF(file) {
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.');
      return;
    }
    const status = document.getElementById('pdfStatus');
    if (status) status.textContent = 'Reading PDF...';
    const arrayBuffer = await file.arrayBuffer();
    try {
      this.pages = await (new PDFStoryExtractor()).loadPDF(arrayBuffer);
      this.stories = await (new PDFStoryExtractor()).detectStories(this.pages);
      this.renderStorySelector();
      if (status) status.textContent = `Found ${this.pages.length} pages, ${this.stories.length} stories, ${this.stories.reduce((a,s)=>a+(s.sentences?.length||0),0)} lines.`;
    } catch (e) {
      console.error(e);
      if (status) status.textContent = 'Error: ' + e.message;
    }
  }

  renderStorySelector() {
    const container = document.getElementById('storySelector');
    if (!container) return;
    container.innerHTML = `
      <h3>📚 Select Story / Episode</h3>
      <div class="story-list">
        ${this.stories.map((s, i) => `
          <div class="story-card" onclick="app.selectStory(${i})">
            <div class="story-title">${this.escapeHtml(s.title || 'Story ' + (i+1))}</div>
            <div class="story-meta">Pages ${s.pages[0]}–${s.pages[s.pages.length-1]} · ${s.sentences?.length || 0} lines</div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:12px;text-align:center;">
        <button class="btn-primary" onclick="app.translateAllStories()">🌐 Translate ALL Stories to ${this.lang.toUpperCase()}</button>
      </div>
    `;
    container.style.display = 'block';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  selectStory(index) {
    this.currentStory = this.stories[index];
    document.querySelectorAll('.story-card').forEach((c, i) => c.classList.toggle('active', i === index));
    this.showStoryEditor();
  }

  showStoryEditor() {
    const editor = document.getElementById('storyEditor');
    if (!editor || !this.currentStory) return;
    const sentences = this.currentStory.sentences || [];
    const lines = sentences.map((text, i) => {
      let speaker = 'Narrator';
      let lineText = text;
      const quoteMatch = text.match(/^["""'](.+)["""']\s*(.*)/);
      if (quoteMatch) {
        lineText = quoteMatch[1];
        const after = quoteMatch[2];
        const saidMatch = after.match(/(?:said|cried|asked|replied|అన్నాడు|అన్నది|चेप्प|अनौ)\s+(\w+)/i);
        if (saidMatch) speaker = saidMatch[1];
      }
      const colonMatch = text.match(/^(\w+[\s\w]*)[:：]\s*(.+)/);
      if (colonMatch) { speaker = colonMatch[1].trim(); lineText = colonMatch[2].trim(); }
      return { id: i, speaker, text: lineText, original: text };
    }).filter(l => l.text.length > 3);
    this.currentStory.lines = lines;

    editor.innerHTML = `
      <h3>🎭 Drama Cast & Lines (${lines.length} lines)</h3>
      <div class="cast-editor" id="castEditor"></div>
      <div class="lines-editor">
        <div class="lines-header">
          <span>#</span><span>Character</span><span>Voice Type</span><span>Dialogue</span>
        </div>
        <div class="lines-list" id="linesList">
          ${lines.slice(0, 100).map((l, i) => `
            <div class="line-row" data-idx="${i}">
              <span class="line-num">${i+1}</span>
              <input class="line-speaker" value="${this.escapeHtml(l.speaker)}" onchange="app.updateSpeaker(${i}, this.value)">
              <select class="line-voice" onchange="app.updateVoice(${i}, this.value)">
                ${Object.entries(CONFIG.voices).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
              </select>
              <input class="line-text" value="${this.escapeHtml(l.text)}" onchange="app.updateText(${i}, this.value)">
            </div>
          `).join('')}
          ${lines.length > 100 ? `<div style="text-align:center;padding:10px;color:rgba(255,255,255,0.5);">... and ${lines.length - 100} more lines ...</div>` : ''}
        </div>
      </div>
      <div class="editor-actions">
        <button class="btn-primary" onclick="app.translateStory()">🌐 Translate to ${this.lang.toUpperCase()}</button>
        <button class="btn-secondary" onclick="app.openTheater()">🎭 Listen in Theater</button>
        <button class="btn-secondary" onclick="app.downloadScript()">⬇ Download Script</button>
      </div>
      <div class="translation-panel" id="translationPanel" style="display:none;">
        <h4>Translation Progress</h4>
        <div class="progress-bar"><div class="progress-fill" id="transProgress"></div></div>
        <div class="translated-text" id="translatedText"></div>
      </div>
    `;
    editor.style.display = 'block';
    this.renderCastEditor();
  }

  renderCastEditor() {
    const container = document.getElementById('castEditor');
    if (!container || !this.currentStory) return;
    const chars = [...new Set(this.currentStory.lines.map(l => l.speaker))];
    window.theater.voiceMapper.autoAssign(chars);
    container.innerHTML = chars.map(c => {
      const info = window.theater.voiceMapper.map[c] || { type: 'narrator', emoji: '🌙' };
      return `
        <div class="cast-chip">
          <span class="cast-emoji">${info.emoji}</span>
          <span class="cast-name">${this.escapeHtml(c)}</span>
          <select onchange="app.setCharacterType('${c.replace(/'/g, "\\'")}', this.value)">
            ${Object.entries(CONFIG.voices).map(([k,v]) => `<option value="${k}" ${k===info.type?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>
      `;
    }).join('');
  }

  setCharacterType(name, type) {
    window.theater.voiceMapper.assign(name, type);
    this.renderCastEditor();
  }
  updateSpeaker(idx, val) { if (this.currentStory) this.currentStory.lines[idx].speaker = val; }
  updateText(idx, val) { if (this.currentStory) this.currentStory.lines[idx].text = val; }
  updateVoice(idx, type) {
    if (!this.currentStory) return;
    const speaker = this.currentStory.lines[idx].speaker;
    window.theater.voiceMapper.assign(speaker, type);
  }

  async translateStory() {
    if (!this.currentStory) return;
    const panel = document.getElementById('translationPanel');
    const fill = document.getElementById('transProgress');
    const textDiv = document.getElementById('translatedText');
    if (panel) if (panel) panel.style.display = 'block';
    const texts = this.currentStory.lines.map(l => l.text);
    const statsBefore = Translator.getCacheStats();
    try {
      const translated = await Translator.translateBatch(texts, this.lang, 'Autodetect', (done, total, netDone, netTotal) => {
        if (fill) fill.style.width = (done / total * 100) + '%';
        if (textDiv) {
          const prov = Translator.bestProvider?.name || '...';
          textDiv.textContent = `Translating ${done}/${total} lines... Provider: ${prov} | Network: ${netDone}/${netTotal} | Cache: ${Translator.stats.cached}`;
        }
      });
      this.currentStory.lines.forEach((l, i) => { l.translated = translated[i]; });
      const statsAfter = Translator.getCacheStats();
      if (textDiv) {
        textDiv.innerHTML = this.currentStory.lines.slice(0, 50).map((l, i) => 
          `<div class="trans-line"><b>${this.escapeHtml(l.speaker)}:</b> ${this.escapeHtml(l.translated || l.text)}</div>`
        ).join('') + (this.currentStory.lines.length > 50 ? `<div style="color:rgba(255,255,255,0.5)">... ${this.currentStory.lines.length - 50} more lines ...</div>` : '') +
        `<div style="margin-top:8px;color:#4ade80;font-size:12px;">✓ Done. Cache: ${statsAfter.size} entries (${statsAfter.cached} hits, ${statsAfter.translated} new, ${statsAfter.failed} fails)</div>`;
      }
    } catch (e) {
      if (textDiv) textDiv.innerHTML = `<div style="color:#f87171;">Translation stopped: ${e.message}</div>`;
    }
    if (fill) fill.style.width = '100%';
  }

  async translateAllStories() {
    const status = document.getElementById('pdfStatus');

    if (!this.stories || this.stories.length === 0) {
      if (status) status.textContent = '⚠ No stories loaded. Please upload a PDF first.';
      return;
    }

    // Ensure all stories have lines parsed
    for (const story of this.stories) {
      if (!story.lines) {
        const sentences = story.sentences || [];
        story.lines = sentences.map(text => ({ speaker: 'Narrator', text, original: text }));
      }
    }

    const totalLines = this.stories.reduce((a, s) => a + (s.lines?.length || 0), 0);
    if (totalLines === 0) {
      if (status) status.textContent = '⚠ No text found in stories.';
      return;
    }

    if (totalLines > 5000) {
      const hasKey = Translator.activeProviders.some(p => p instanceof UserKeyProvider);
      if (!hasKey) {
        const go = confirm(`WARNING: You are about to translate ~${totalLines} lines without a paid API key. Free providers will rate-limit heavily and this may take hours or fail entirely.\n\nFor 1M+ words, you MUST add a Google Cloud, DeepL, or Azure API key in Settings.\n\nClick OK to proceed anyway (very slow), or Cancel to open Settings.`);
        if (!go) { this.openSettings(); return; }
      }
    }

    if (status) {
      status.innerHTML = `<div>Translating ${this.stories.length} stories (~${totalLines} lines) to <b>${this.lang.toUpperCase()}</b>...</div>
        <div style="margin-top:6px;height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
          <div id="allTransProgress" style="height:100%;width:0%;background:linear-gradient(90deg,#fbbf24,#f59e0b);transition:width 0.3s;"></div>
        </div>
        <div id="allTransDetail" style="margin-top:4px;font-size:12px;color:#c4b5fd;">Starting...</div>`;
    }

    Translator.cancel();
    let globalDone = 0;

    for (let i = 0; i < this.stories.length; i++) {
      this.currentStory = this.stories[i];
      const texts = this.currentStory.lines.map(l => l.text);
      const storyTotal = texts.length;

      try {
        const translated = await Translator.translateBatch(texts, this.lang, 'Autodetect', (done, total, netDone, netTotal) => {
          globalDone++;
          const pct = Math.round((globalDone / totalLines) * 100);
          const prog = document.getElementById('allTransProgress');
          const detail = document.getElementById('allTransDetail');
          if (prog) prog.style.width = pct + '%';
          if (detail) detail.textContent = `Story ${i+1}/${this.stories.length}: ${this.currentStory.title || 'Untitled'} — line ${done}/${total} (${pct}%) | Provider: ${Translator.bestProvider?.name || '...'}`;
        });

        this.currentStory.lines.forEach((l, idx) => { l.translated = translated[idx]; });
      } catch (e) {
        const detail = document.getElementById('allTransDetail');
        if (detail) detail.innerHTML = `<span style="color:#f87171;">Stopped at story ${i+1}: ${e.message}</span>`;
        return;
      }
    }

    const stats = Translator.getCacheStats();
    if (status) {
      status.innerHTML = `<div style="color:#4ade80;">✓ All ${this.stories.length} stories translated!</div>
        <div style="font-size:12px;color:#a78bfa;margin-top:4px;">Cache: ${stats.size} entries (${stats.cached} cached, ${stats.translated} new, ${stats.failed} failed)</div>`;
    }
    this.renderStorySelector();
  }

  openTheater() {
    if (!this.currentStory || !this.currentStory.lines || this.currentStory.lines.length === 0) return;
    const hasTranslation = this.currentStory.lines.some(l => l.translated);
    if (!hasTranslation) {
      const go = confirm('🎭 Text is not yet translated to ' + this.lang.toUpperCase() + '.\n\nTheater will speak in the original language (Sanskrit/Hindi), which may not sound correct if your browser lacks Indic voices.\n\nClick OK to translate first, or Cancel to play original.');
      if (go) { this.translateStory(); return; }
    }
    const script = { title: this.currentStory.title, lines: this.currentStory.lines };
    window.theater.loadScript(script, this.lang);
    window.theater.open();
    window.theater.play();
  }

  renderSettings() {
    const existing = document.getElementById('cmSettingsPanel');
    if (existing) return;
    const panel = document.createElement('div');
    panel.id = 'cmSettingsPanel';
    panel.style.cssText = 'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e1b4b;border:1px solid #4c1d95;border-radius:12px;padding:24px;max-width:420px;width:90%;z-index:10000;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,0.6);font-family:sans-serif;';
    panel.innerHTML = `
      <h3 style="margin:0 0 16px;color:#c084fc;">⚙️ Translation Settings</h3>
      <p style="font-size:12px;color:#a78bfa;margin:0 0 12px;">For 1,000+ lines, add a paid API key. Free providers rate-limit heavily.</p>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;color:#c4b5fd;margin-bottom:4px;">Google Cloud API Key</label>
        <input type="password" id="cmKeyGoogle" placeholder="AIza..." style="width:100%;padding:8px;border-radius:6px;border:1px solid #4c1d95;background:#0f0a1e;color:#fff;font-size:13px;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;color:#c4b5fd;margin-bottom:4px;">DeepL API Key</label>
        <input type="password" id="cmKeyDeepL" placeholder="DeepL-Auth-Key ..." style="width:100%;padding:8px;border-radius:6px;border:1px solid #4c1d95;background:#0f0a1e;color:#fff;font-size:13px;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;color:#c4b5fd;margin-bottom:4px;">Azure Translator Key</label>
        <input type="password" id="cmKeyAzure" placeholder="..." style="width:100%;padding:8px;border-radius:6px;border:1px solid #4c1d95;background:#0f0a1e;color:#fff;font-size:13px;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;color:#c4b5fd;margin-bottom:4px;">Azure Region (e.g. global, westus2)</label>
        <input type="text" id="cmKeyAzureRegion" placeholder="global" style="width:100%;padding:8px;border-radius:6px;border:1px solid #4c1d95;background:#0f0a1e;color:#fff;font-size:13px;">
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;color:#c4b5fd;margin-bottom:4px;">Provider Status</div>
        <div id="cmProviderStatus" style="font-size:12px;color:#a78bfa;line-height:1.6;"></div>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="app.saveSettings()" style="flex:1;padding:10px;background:#7c3aed;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;">Save Keys</button>
        <button onclick="app.clearCache()" style="padding:10px;background:#374151;border:none;border-radius:6px;color:#fff;cursor:pointer;">Clear Cache</button>
        <button onclick="document.getElementById('cmSettingsPanel').style.display='none'" style="padding:10px;background:#374151;border:none;border-radius:6px;color:#fff;cursor:pointer;">Close</button>
      </div>
    `;
    document.body.appendChild(panel);
    this.loadSettings();
  }

  renderSettingsButton() {
    const btn = document.createElement('button');
    btn.textContent = '⚙️ Settings';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;padding:10px 16px;background:#7c3aed;border:none;border-radius:8px;color:#fff;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    btn.onclick = () => this.openSettings();
    document.body.appendChild(btn);
  }

  openSettings() {
    const panel = document.getElementById('cmSettingsPanel');
    if (panel) { this.updateProviderStatusUI(); panel.style.display = 'block'; }
  }

  updateProviderStatusUI() {
    const div = document.getElementById('cmProviderStatus');
    if (!div) return;
    const status = Translator.providerStatus;
    div.innerHTML = status.map(s => {
      const color = s.available ? '#4ade80' : '#f87171';
      const note = s.circuitOpen ? ' (circuit open)' : '';
      return `<div>● <span style="color:${color}">${s.name}</span>${note} — fails: ${s.failures}</div>`;
    }).join('');
  }

  loadSettings() {
    const g = localStorage.getItem('cm_api_key_google') || '';
    const d = localStorage.getItem('cm_api_key_deepl') || '';
    const a = localStorage.getItem('cm_api_key_azure') || '';
    const r = localStorage.getItem('cm_api_key_azure_region') || 'global';
    const elG = document.getElementById('cmKeyGoogle');
    const elD = document.getElementById('cmKeyDeepL');
    const elA = document.getElementById('cmKeyAzure');
    const elR = document.getElementById('cmKeyAzureRegion');
    if (elG) elG.value = g;
    if (elD) elD.value = d;
    if (elA) elA.value = a;
    if (elR) elR.value = r;
  }

  saveSettings() {
    const g = document.getElementById('cmKeyGoogle')?.value.trim() || '';
    const d = document.getElementById('cmKeyDeepL')?.value.trim() || '';
    const a = document.getElementById('cmKeyAzure')?.value.trim() || '';
    const r = document.getElementById('cmKeyAzureRegion')?.value.trim() || 'global';
    if (g) localStorage.setItem('cm_api_key_google', g); else localStorage.removeItem('cm_api_key_google');
    if (d) localStorage.setItem('cm_api_key_deepl', d); else localStorage.removeItem('cm_api_key_deepl');
    if (a) localStorage.setItem('cm_api_key_azure', a); else localStorage.removeItem('cm_api_key_azure');
    localStorage.setItem('cm_api_key_azure_region', r);
    this.updateProviderStatusUI();
    alert('Settings saved. Paid providers will now be used.');
  }

  clearCache() {
    Translator.clearCache();
    this.updateProviderStatusUI();
    alert('Translation cache cleared.');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  downloadScript() {
    if (!this.currentStory) return;
    const data = { title: this.currentStory.title, language: this.lang, lines: this.currentStory.lines };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chandamama_${(this.currentStory.title || 'story').replace(/\W+/g,'_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => { app = new ChandamamaApp(); });
