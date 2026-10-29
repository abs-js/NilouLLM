/**
 * Nilou - Modelo mais pensativo
 * Usa quintgramas (n=5) por padrão + blend de quadrigramas (n=4)
 * Seleção inteligente de frase-semente, sampling com temperatura
 * e parada mais cedo para consumir menos tokens.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class BasicLanguageModel {
  constructor(options = {}) {
    this.n = options.n || 5; // quintgramas por padrão
    this.temperature = options.temperature || 0.35;
    this.maxTokens = options.maxTokens || 60;
    this.paramsDir = options.paramsDir || path.join(__dirname, '../params');
    this.blendN4 = options.blendN4 !== false; // mistura quadrigramas

    this.knowledge = [];
    this.topicNgrams = new Map(); // n=5
    this.topicNgrams4 = new Map(); // n=4 extra
    this.loadKnowledge();
  }

  loadKnowledge() {
    if (!fs.existsSync(this.paramsDir)) return;
    const files = fs.readdirSync(this.paramsDir).filter(f => f.endsWith('.txt'));

    for (const file of files) {
      const topic = path.basename(file, '.txt');
      let content = fs.readFileSync(path.join(this.paramsDir, file), 'utf-8');
      content = content.replace(/\\n/g, '\n');
      const sentences = content.split(/[\n.!?]+/).map(s => s.trim()).filter(s => s.length > 4 && !s.includes('</s>'));
      this.knowledge.push({ topic, content, sentences });
      this.topicNgrams.set(topic, this.buildNgrams(content, this.n));
      if (this.blendN4) this.topicNgrams4.set(topic, this.buildNgrams(content, 4));
    }
    console.log(`Conhecimento carregado: ${this.knowledge.length} tópicos (n=${this.n}${this.blendN4 ? '+4' : ''})`);
  }

  tokenize(text) {
    return text.toLowerCase().replace(/[^\w\sáéíóúâêîôûãõç+\-*/=<>]/g, ' ').split(/\s+/).filter(Boolean);
  }

  buildNgrams(text, n) {
    const ngrams = new Map();
    const tokens = this.tokenize(text);
    for (let i = 0; i < tokens.length - n + 1; i++) {
      const context = tokens.slice(i, i + n - 1).join(' ');
      const next = tokens[i + n - 1];
      if (!ngrams.has(context)) ngrams.set(context, new Map());
      const counts = ngrams.get(context);
      counts.set(next, (counts.get(next) || 0) + 1);
    }
    return ngrams;
  }

  scoreTopic(item, qTokens) {
    let score = 0;
    const contentTokens = new Set(this.tokenize(item.content));
    const topicTokens = new Set(this.tokenize(item.topic));
    for (const t of qTokens) {
      if (contentTokens.has(t)) score += 2;
      if (topicTokens.has(t)) score += 4;
    }
    score += Math.min(item.sentences.length, 8) * 0.3;
    return score;
  }

  findBestTopic(query) {
    const qTokens = new Set(this.tokenize(query));
    let best = null;
    let bestScore = -1;

    for (const item of this.knowledge) {
      const score = this.scoreTopic(item, qTokens);
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    return best || this.knowledge[0];
  }

  findBestSentence(topicItem, query) {
    const qTokens = new Set(this.tokenize(query));
    let best = topicItem.sentences[0] || '';
    let bestScore = -1;

    for (const sent of topicItem.sentences) {
      const sTokens = new Set(this.tokenize(sent));
      let score = 0;
      for (const t of qTokens) if (sTokens.has(t)) score += 1;
      const len = this.tokenize(sent).length;
      if (len >= 4 && len <= 25) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = sent;
      }
    }
    return best;
  }

  sampleFromCandidates(candidates, temperature = this.temperature) {
    if (!candidates || candidates.size === 0) return '';
    const entries = Array.from(candidates.entries());
    if (temperature <= 0.05) {
      return entries.reduce((a, b) => (a[1] > b[1] ? a : b))[0];
    }

    const total = entries.reduce((s, [, c]) => s + c, 0);
    const weights = entries.map(([, c]) => Math.pow(c / total, 1 / temperature));
    const sumW = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sumW;
    for (let i = 0; i < entries.length; i++) {
      r -= weights[i];
      if (r <= 0) return entries[i][0];
    }
    return entries[0][0];
  }

  nextToken(topic, contextTokens) {
    const ngrams = this.topicNgrams.get(topic);
    const ngrams4 = this.topicNgrams4.get(topic);
    const ctx5 = contextTokens.slice(-(this.n - 1)).join(' ');
    const ctx4 = contextTokens.slice(-3).join(' '); // contexto de 3 para n=4 (n-1=3)

    let candidates = new Map();

    // principal (n=5)
    if (ngrams?.has(ctx5)) {
      for (const [w, c] of ngrams.get(ctx5)) {
        candidates.set(w, (candidates.get(w) || 0) + c * 1.5);
      }
    }
    // blend quadrigramas
    if (this.blendN4 && ngrams4?.has(ctx4)) {
      for (const [w, c] of ngrams4.get(ctx4)) {
        candidates.set(w, (candidates.get(w) || 0) + c * 0.7);
      }
    }

    return this.sampleFromCandidates(candidates);
  }

  generateUntilEnd(prompt, maxTokens = this.maxTokens) {
    const best = this.findBestTopic(prompt);
    if (!best) return { text: 'Não sei. </s>', tokens: 2, topic: null };

    const seed = this.findBestSentence(best, prompt);
    let current = seed;
    const generated = [seed];
    let tokensUsed = this.tokenize(seed).length;

    let consecutiveLowConf = 0;

    for (let i = 0; i < maxTokens && tokensUsed < maxTokens; i++) {
      const tokens = this.tokenize(current);
      const word = this.nextToken(best.topic, tokens);

      if (!word || word === '</s>' || word.includes('</s>')) {
        generated.push('</s>');
        break;
      }

      const ngrams = this.topicNgrams.get(best.topic);
      const ctx = tokens.slice(-(this.n - 1)).join(' ');
      const cands = ngrams?.get(ctx);
      const conf = cands ? (cands.get(word) || 0) / Array.from(cands.values()).reduce((a, b) => a + b, 1) : 0;
      if (conf < 0.25) consecutiveLowConf++;
      else consecutiveLowConf = 0;

      if (consecutiveLowConf >= 3 && tokensUsed > 8) {
        generated.push('</s>');
        break;
      }

      generated.push(word);
      current += ' ' + word;
      tokensUsed++;
    }

    if (!generated[generated.length - 1]?.includes('</s>')) generated.push('</s>');
    const text = generated.join(' ').replace(/\s+/g, ' ').trim();
    return { text, tokens: tokensUsed, topic: best.topic };
  }

  answer(query) {
    return this.generateUntilEnd(query).text;
  }

  stats() {
    return {
      topics: this.knowledge.length,
      topicsList: this.knowledge.map(k => k.topic),
      n: this.n,
      blendN4: this.blendN4
    };
  }
}
