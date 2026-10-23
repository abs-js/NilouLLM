/**
 * Nilou - Modelo organizado por tópicos
 * Sempre gera por next-word até </s>
 * Primeiro escolhe o tópico mais relevante, depois gera só a partir dele.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class BasicLanguageModel {
  constructor(options = {}) {
    this.n = options.n || 2;
    this.temperature = options.temperature || 0.4;
    this.maxTokens = options.maxTokens || 80;
    this.paramsDir = options.paramsDir || path.join(__dirname, '../params');

    this.knowledge = [];
    this.topicNgrams = new Map();
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
      this.topicNgrams.set(topic, this.buildNgrams(content));
    }
    console.log(`Conhecimento carregado: ${this.knowledge.length} tópicos`);
  }

  tokenize(text) {
    return text.toLowerCase().replace(/[^\w\sáéíóúâêîôûãõç+\-*/=<>]/g, ' ').split(/\s+/).filter(Boolean);
  }

  buildNgrams(text) {
    const ngrams = new Map();
    const tokens = this.tokenize(text);
    for (let i = 0; i < tokens.length - this.n + 1; i++) {
      const context = tokens.slice(i, i + this.n - 1).join(' ');
      const next = tokens[i + this.n - 1];
      if (!ngrams.has(context)) ngrams.set(context, new Map());
      const counts = ngrams.get(context);
      counts.set(next, (counts.get(next) || 0) + 1);
    }
    return ngrams;
  }

  findBestTopic(query) {
    const qTokens = new Set(this.tokenize(query));
    let best = null;
    let bestScore = 0;

    for (const item of this.knowledge) {
      let score = 0;
      const contentTokens = this.tokenize(item.content);
      for (const t of qTokens) {
        if (contentTokens.includes(t)) score += 2;
        if (item.topic.includes(t)) score += 3;
      }
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    return best || this.knowledge[0];
  }

  nextTokenFromTopic(topic, contextTokens) {
    const ngrams = this.topicNgrams.get(topic);
    if (!ngrams) return '';
    const context = contextTokens.slice(-(this.n - 1)).join(' ');
    const candidates = ngrams.get(context);
    if (!candidates || candidates.size === 0) return '';

    const entries = Array.from(candidates.entries());
    const total = entries.reduce((s, [, c]) => s + c, 0);
    let r = Math.random() * total;
    for (const [w, c] of entries) {
      r -= c;
      if (r <= 0) return w;
    }
    return entries[0][0];
  }

  generateUntilEnd(prompt, maxTokens = 80) {
    const best = this.findBestTopic(prompt);
    if (!best) return { text: 'Não sei. </s>', tokens: 2 };

    let seed = best.sentences[0] || best.content.slice(0, 80);
    let current = seed;
    const generated = [seed];
    let tokensUsed = this.tokenize(seed).length;

    for (let i = 0; i < maxTokens && tokensUsed < maxTokens; i++) {
      const tokens = this.tokenize(current);
      const word = this.nextTokenFromTopic(best.topic, tokens);
      if (!word || word === '</s>' || word.includes('</s>')) {
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
    return { topics: this.knowledge.length, topicsList: this.knowledge.map(k => k.topic) };
  }
}
