/**
 * Arquivo de testes do Nilou
 * Coloque a pergunta e o token abaixo e rode: node tests/test.js
 *
 * Modo local: usa o modelo diretamente (não precisa de servidor).
 * Modo API: se TOKEN e URL estiverem preenchidos, chama o servidor.
 */

import { BasicLanguageModel } from '../src/model.js';

// ========== CONFIGURAÇÃO ==========
const PERGUNTA = "O que é Python?";          // coloque sua pergunta aqui
const TOKEN = "";                          // coloque seu token de API aqui (opcional)
const URL = "http://localhost:3000";       // URL do servidor (se for testar via API)
const MAX_TOKENS = 60;
// ===================================

async function testLocal() {
  console.log("=== Teste LOCAL (modelo direto) ===");
  const model = new BasicLanguageModel({ n: 5, blendN4: true, temperature: 0.35, maxTokens: MAX_TOKENS });
  console.log("Stats:", model.stats());
  const result = model.generateUntilEnd(PERGUNTA, MAX_TOKENS);
  console.log("\nPergunta:", PERGUNTA);
  console.log("Resposta:", result.text);
  console.log("Tokens:", result.tokens, "| Tópico:", result.topic);
}

async function testAPI() {
  if (!TOKEN) {
    console.log("\n=== Teste API ignorado (TOKEN vazio) ===");
    return;
  }
  console.log("\n=== Teste via API ===");
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        k: TOKEN,
        q: PERGUNTA,
        c: { maxTokens: MAX_TOKENS }
      })
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Resposta:", data);
  } catch (e) {
    console.error("Erro na API:", e.message);
  }
}

(async () => {
  await testLocal();
  await testAPI();
})();
