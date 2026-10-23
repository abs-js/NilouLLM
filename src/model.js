/**
 * Nilou Language Model - pure JS from scratch
 * Always generates via next-word until </s>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class BasicLanguageModel {
  constructor(options = {}) {
    this.mode = options.mode || 'normal';
    this.n = options.n || 2;
    this.temperature = options.temperature || 0.6;
    this.maxTokens = options.maxTokens || 80;
    this.paramsDir = options.paramsDir || path.join(__dirname, '../params');
    this.ngrams = new Map();
    this.knowledge = [];
    this.vocabulary = new Set();
    this.loadKnowledge();
    this.train();
  }

  loadKnowledge() {
    if (!fs.existsSync(this.paramsDir)) return;
    const files = fs.readdirSync(this.paramsDir).filter(f => f.endsWith('.txt'));
    for (const file of files) {
      const topic = path.basename(file, '.txt');
      const content = fs.readFileSync(path.join(this.paramsDir, file), 'utf-8');
      const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
      this.knowledge.push({ topic, content, sentences });
      this.tokenize(content).forEach(t => this.vocabulary.add(t));
    }
    console.log(`Conhecimento: ${this.knowledge.length} tópicos`);
  }

  tokenize(text) {
    return text.toLowerCase().replace(/[^\w\sáéíóúâêîôûãõç+\-*/=<>]/g, ' ').split(/\s+/).filter(Boolean);
  }

  train() {
    const allText = this.knowledge.map(k => k.content).join(' ');
    const tokens = this.tokenize(allText);
    for (let i = 0; i < tokens.length - this.n + 1; i++) {
      const context = tokens.slice(i, i + this.n - 1).join(' ');
      const next = tokens[i + this.n - 1];
      if (!this.ngrams.has(context)) this.ngrams.set(context, new Map());
      const counts = this.ngrams.get(context);
      counts.set(next, (counts.get(next) || 0) + 1);
    }
  }

  nextWord(text) {
    const tokens = this.tokenize(text);
    if (!tokens.length) return { word: '', confidence: 0 };
    const next = this.nextToken(tokens);
    return { word: next || '', confidence: 0.5 };
  }

  nextToken(contextTokens) {
    const context = contextTokens.slice(-(this.n - 1)).join(' ');
    const candidates = this.ngrams.get(context);
    if (!candidates || !candidates.size) return '';
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
    let current = prompt.trim();
    const generated = [];
    let tokensUsed = 0;
    for (let i = 0; i < maxTokens; i++) {
      const pred = this.nextWord(current);
      const word = pred.word || '';
      if (!word || word === '</s>' || word.includes('</s>')) {
        generated.push('</s>');
        break;
      }
      generated.push(word);
      current += ' ' + word;
      tokensUsed++;
    }
    if (!generated.includes('</s>')) generated.push('</s>');
    return {
      text: generated.join(' ').replace(/\s+<\/s>/, '</s>'),
      tokens: tokensUsed
    };
  }

  answer(query) {
    return this.generateUntilEnd(query).text;
  }

  stats() {
    return { topics: this.knowledge.length, vocabulary: this.vocabulary.size };
  }
}
