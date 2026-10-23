/**
 * Nilou Language Model - pure JS from scratch
 * Tools: calculator, search, extract
 * Modes: fast, normal, thinker
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
    this.maxTokens = options.maxTokens || 60;
    this.revisionSteps = options.revisionSteps ?? (this.mode === 'thinker' ? 2 : 1);
    this.thinkingRounds = options.thinkingRounds ?? (this.mode === 'thinker' ? 3 : 1);
    this.paramsDir = options.paramsDir || path.join(__dirname, '../params');

    this.neuronWeights = options.neuronWeights || {
      keyword: 1.2,
      topic: 1.5,
      calc: 2.0,
      tool: 1.8
    };

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
      const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 8);
      this.knowledge.push({ topic, content, sentences });
      this.tokenize(content).forEach(t => this.vocabulary.add(t));
    }
    console.log(`[${this.mode}] Conhecimento: ${this.knowledge.length} tópicos`);
  }

  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\sáéíóúâêîôûãõç+\-*/=]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
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

  toolCalculator(a, op, b) {
    const ops = {
      '+': (x, y) => x + y,
      '-': (x, y) => x - y,
      '*': (x, y) => x * y,
      '/': (x, y) => y !== 0 ? x / y : null,
      '**': (x, y) => x ** y,
      '^': (x, y) => x ** y
    };

    let numA, numB, operator;

    if (typeof a === 'string' && op === undefined) {
      const match = a.match(/(-?\d+\.?\d*)\s*([+\-*/^])\s*(-?\d+\.?\d*)/);
      if (!match) return null;
      numA = parseFloat(match[1]);
      operator = match[2] === '^' ? '**' : match[2];
      numB = parseFloat(match[3]);
    } else {
      numA = parseFloat(a);
      numB = parseFloat(b);
      operator = op;
    }

    if (isNaN(numA) || isNaN(numB) || !ops[operator]) return null;
    const result = ops[operator](numA, numB);
    if (result === null || !isFinite(result)) return null;

    return { tool: 'calculadora', input: `${numA} ${operator} ${numB}`, result };
  }

  toolSearch(query, topK = 2) {
    const relevant = this.retrieve(query, topK);
    return {
      tool: 'buscar',
      query,
      results: relevant.map(r => ({
        topic: r.topic,
        score: r.score,
        preview: r.sentences[0]?.slice(0, 120) || ''
      }))
    };
  }

  toolExtract(query, topic = null) {
    const items = topic ? this.knowledge.filter(k => k.topic === topic) : this.knowledge;
    const sentences = [];
    const qTokens = this.tokenize(query);

    for (const item of items) {
      for (const sent of item.sentences) {
        const overlap = qTokens.filter(t => sent.toLowerCase().includes(t)).length;
        if (overlap > 0) sentences.push({ sentence: sent, topic: item.topic, score: overlap });
      }
    }
    sentences.sort((a, b) => b.score - a.score);
    return { tool: 'extrair', sentences: sentences.slice(0, 3) };
  }

  retrieve(query, topK = 3) {
    const queryTokens = new Set(this.tokenize(query));
    const scores = [];
    for (const item of this.knowledge) {
      let score = 0;
      const contentTokens = this.tokenize(item.content);
      for (const token of queryTokens) {
        if (contentTokens.includes(token)) score += this.neuronWeights.keyword;
      }
      if (query.toLowerCase().includes(item.topic)) score += this.neuronWeights.topic;
      if (score > 0) scores.push({ ...item, score });
    }
    return scores.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  answerFast(query) {
    const calc = this.detectAndCalculate(query);
    if (calc) return `Cálculo: ${calc.input} = ${calc.result}`;

    const relevant = this.retrieve(query, 1);
    if (!relevant.length) return "Não sei. Sem informação na base.";

    const best = relevant[0];
    const sent = best.sentences.find(s => this.tokenize(query).some(t => s.toLowerCase().includes(t))) || best.sentences[0];
    return `[${best.topic}] ${sent}`;
  }

  answerNormal(query) {
    const calc = this.detectAndCalculate(query);
    if (calc) return `Cálculo: ${calc.input} = ${calc.result}`;

    const extract = this.toolExtract(query);
    if (!extract.sentences.length) return "Não encontrei informações relevantes.";

    let draft = extract.sentences.map(s => s.sentence).join('. ');
    return this.revise(draft, query);
  }

  answerThinker(query) {
    const calc = this.detectAndCalculate(query);
    const extract = this.toolExtract(query);

    let draft = '';
    if (calc) draft += `Resultado do cálculo: ${calc.result}. `;
    if (extract.sentences.length) {
      draft += extract.sentences.map(s => s.sentence).join('. ');
    } else {
      draft += "Não encontrei informação específica.";
    }

    return this.revise(draft, query);
  }

  detectAndCalculate(query) {
    const fullMatch = query.match(/(-?\d+\.?\d*(?:\s*[+\-*/^]\s*-?\d+\.?\d*)+)/);
    if (fullMatch) {
      try {
        const expr = fullMatch[1].replace(/\^/g, '**');
        const clean = expr.replace(/[^0-9+\-*/().\s]/g, '');
        if (clean && /[\d]/.test(clean)) {
          const result = Function(`"use strict"; return (${clean})`)();
          if (typeof result === 'number' && isFinite(result)) {
            return { tool: 'calculadora', input: fullMatch[1].trim(), result };
          }
        }
      } catch (e) {}
    }

    const simple = query.match(/(-?\d+\.?\d*)\s*([+\-*/^])\s*(-?\d+\.?\d*)/);
    if (simple) return this.toolCalculator(simple[1], simple[2], simple[3]);
    return null;
  }

  revise(draft, query) {
    let revised = draft.replace(/\s+/g, ' ').trim();
    if (revised.length > 450) revised = revised.slice(0, 450) + '...';
    return revised;
  }

  answer(query) {
    if (!query?.trim()) return "Pergunta vazia.";
    switch (this.mode) {
      case 'fast': return this.answerFast(query);
      case 'thinker': return this.answerThinker(query);
      default: return this.answerNormal(query);
    }
  }

  stats() {
    return {
      mode: this.mode,
      topics: this.knowledge.length,
      vocabulary: this.vocabulary.size,
      thinkingRounds: this.thinkingRounds,
      revisionSteps: this.revisionSteps,
      tools: ['calculadora', 'buscar', 'extrair']
    };
  }
}
