/* ============================================
   Chandamama PDF Auto-Processor
   Client-side PDF text extraction & dramatization
   Uses PDF.js to load PDFs directly from any URL
   ============================================ */

class PDFAutoProcessor {
  constructor() {
    this.pdfDoc = null;
    this.extractedText = '';
    this.parsedStory = null;
    this.isProcessing = false;
  }

  async loadPDF(url) {
    this.isProcessing = true;
    this.updateStatus('📥 Loading PDF from URL...', 'info');

    try {
      if (typeof pdfjsLib === 'undefined') {
        await this.loadPDFJS();
      }

      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const loadingTask = pdfjsLib.getDocument({
        url: url,
        useSystemFonts: true,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
      });

      this.pdfDoc = await loadingTask.promise;
      this.updateStatus(`📄 PDF loaded: ${this.pdfDoc.numPages} pages`, 'ok');
      return this.pdfDoc;
    } catch (e) {
      console.error('[PDF] Load error:', e);
      this.updateStatus('❌ Could not load PDF. Try a direct link or CORS-enabled URL.', 'err');
      this.isProcessing = false;
      throw e;
    }
  }

  loadPDFJS() {
    return new Promise((resolve, reject) => {
      if (typeof pdfjsLib !== 'undefined') { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async extractText() {
    if (!this.pdfDoc) return;

    this.updateStatus('🔍 Extracting text from all pages...', 'info');
    let fullText = '';

    for (let i = 1; i <= this.pdfDoc.numPages; i++) {
      try {
        const page = await this.pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `\n--- PAGE ${i} ---\n${pageText}\n`;

        const pct = Math.round((i / this.pdfDoc.numPages) * 100);
        this.updateStatus(`🔍 Extracting... ${pct}% (${i}/${this.pdfDoc.numPages} pages)`, 'info');
      } catch (e) {
        console.warn(`[PDF] Page ${i} error:`, e);
      }
    }

    this.extractedText = fullText;
    this.updateStatus(`✅ Extracted ${fullText.length.toLocaleString()} characters`, 'ok');
    return fullText;
  }

  parseToStory() {
    if (!this.extractedText) return null;
    this.updateStatus('🎭 Parsing text into dramatized script...', 'info');

    const text = this.extractedText;
    const lines = text.split(/\n+/).filter(l => l.trim().length > 10);
    const pages = text.split(/--- PAGE \d+ ---/);
    const story = this.heuristicParse(lines, pages);

    this.parsedStory = story;
    this.updateStatus(`✅ Created ${story.episodes.length} episodes with ${story.episodes.reduce((a,e) => a + e.script.length, 0)} lines`, 'ok');
    return story;
  }

  heuristicParse(lines, pages) {
    const hasDevanagari = /[\u0900-\u097F]/.test(this.extractedText);
    const hasTelugu = /[\u0C00-\u0C7F]/.test(this.extractedText);
    const hasTamil = /[\u0B80-\u0BFF]/.test(this.extractedText);
    const hasKannada = /[\u0C80-\u0CFF]/.test(this.extractedText);
    const hasMalayalam = /[\u0D00-\u0D7F]/.test(this.extractedText);
    const hasBengali = /[\u0980-\u09FF]/.test(this.extractedText);

    let lang = 'English';
    if (hasDevanagari) lang = 'Sanskrit/Hindi';
    else if (hasTelugu) lang = 'Telugu';
    else if (hasTamil) lang = 'Tamil';
    else if (hasKannada) lang = 'Kannada';
    else if (hasMalayalam) lang = 'Malayalam';
    else if (hasBengali) lang = 'Bengali';

    const chunks = this.splitIntoChunks(lines, 15);
    const detectedChars = this.detectCharacters(lines);

    const cast = detectedChars.length > 0
      ? detectedChars.map((name, i) => ({
          name: name,
          role: `Character ${i+1}`,
          emoji: ['🤴','👸','🧙','⚔️','👧','🐰','🦋','🐿️'][i % 8],
          voice: {
            pitch: 0.7 + (i * 0.1),
            rate: 0.8 + (i * 0.05),
            pref: i % 2 === 0 ? 'male' : 'female'
          },
          description: 'Auto-detected character from PDF text'
        }))
      : [
        { name: "Narrator", role: "Storyteller", emoji: "🌙",
          voice: {pitch: 1.0, rate: 0.85, pref: "male"},
          description: "Auto-generated narrator" },
        { name: "Character One", role: "Protagonist", emoji: "🤴",
          voice: {pitch: 0.8, rate: 0.85, pref: "male"},
          description: "Auto-generated character" },
        { name: "Character Two", role: "Companion", emoji: "👸",
          voice: {pitch: 1.15, rate: 0.9, pref: "female"},
          description: "Auto-generated character" }
      ];

    const scenes = chunks.map((chunk, i) => ({
      id: `scene${i+1}`,
      title: `Scene ${i+1}`,
      setting: chunk.slice(0, 3).join(' ').substring(0, 120) + '...',
      mood: ['mysterious', 'warm', 'dramatic', 'playful', 'wise'][i % 5],
      bg: [
        'linear-gradient(180deg, #1a1a2e 0%, #2d1b4e 50%, #0f3460 100%)',
        'linear-gradient(180deg, #0f0f23 0%, #1a2e1a 40%, #27ae60 100%)',
        'linear-gradient(180deg, #16213e 0%, #1a1a2e 60%, #e67e22 100%)',
        'linear-gradient(180deg, #8e44ad 0%, #e67e22 50%, #f39c12 100%)',
        'linear-gradient(180deg, #0f0f23 0%, #1a1a2e 50%, #138808 100%)'
      ][i % 5]
    }));

    const script = [];
    let currentScene = 'scene1';

    lines.forEach((line, i) => {
      if (line.includes('--- PAGE') && i > 0) {
        const pageNum = parseInt(line.match(/PAGE (\d+)/)?.[1] || '1');
        currentScene = `scene${Math.min(Math.ceil(pageNum / 2), scenes.length)}`;
      }

      let speaker = cast[0].name;
      let emotion = 'neutral';

      for (const c of cast) {
        if (line.toLowerCase().startsWith(c.name.toLowerCase()) ||
            line.includes(c.name + ':') ||
            line.includes(c.name + ' says')) {
          speaker = c.name;
          break;
        }
      }

      const lower = line.toLowerCase();
      if (lower.includes('!') && lower.includes('?')) emotion = 'confused';
      else if (lower.includes('!')) emotion = 'excited';
      else if (lower.includes('?')) emotion = 'curious';
      else if (lower.includes('love') || lower.includes('kind')) emotion = 'warm';
      else if (lower.includes('fear') || lower.includes('dark')) emotion = 'scared';
      else if (lower.includes('king') || lower.includes('royal')) emotion = 'majestic';

      script.push({
        speaker: speaker,
        text: line.trim().substring(0, 300),
        emotion: emotion,
        scene: currentScene
      });
    });

    const episode = {
      id: 'auto-ep01',
      title: `Auto-Processed: ${lang} Story`,
      subtitle: `Extracted from PDF • ${this.pdfDoc?.numPages || '?'} pages • ${script.length} lines`,
      art: '📄',
      duration: `${Math.ceil(script.length * 0.3)} min`,
      date: 'Auto',
      ages: 'All ages',
      audio: '',
      source: 'Auto-processed from PDF',
      cast: cast,
      scenes: scenes,
      script: script
    };

    return {
      language: 'auto',
      languageName: lang,
      source: 'Auto-processed PDF',
      episodes: [episode]
    };
  }

  splitIntoChunks(lines, chunkSize) {
    const chunks = [];
    for (let i = 0; i < lines.length; i += chunkSize) {
      chunks.push(lines.slice(i, i + chunkSize));
    }
    return chunks;
  }

  detectCharacters(lines) {
    const names = new Set();
    const patterns = [
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|says|cried|shouted|whispered|asked)/g,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?):/gm,
      /(?:King|Queen|Prince|Princess|Lord|Lady|Sage|Doctor|Captain|Minister)\s+([A-Z][a-z]+)/g
    ];

    lines.forEach(line => {
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const name = match[1] || match[0];
          if (name && name.length > 2 && name.length < 30 && !/^(The|And|But|For|She|He|They|This|That|With|From|Into|Over|Under)$/i.test(name)) {
            names.add(name);
          }
        }
      });
    });

    return Array.from(names).slice(0, 8);
  }

  updateStatus(msg, type) {
    const statusEl = document.getElementById('pdfStatus');
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.className = 'status-msg show ' + type;
    }
    console.log(`[PDF] ${msg}`);
  }

  async process(url) {
    try {
      await this.loadPDF(url);
      await this.extractText();
      const story = this.parseToStory();
      return story;
    } catch (e) {
      console.error('[PDF] Process failed:', e);
      throw e;
    } finally {
      this.isProcessing = false;
    }
  }
}

window.pdfProcessor = new PDFAutoProcessor();
