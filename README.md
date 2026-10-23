# Nilou 0.0.0

Modelo de linguagem básico implementado **do absoluto zero** em JavaScript puro (sem bibliotecas de redes neurais).

**Nome do agente:** Nilou  
**Versão:** 0.0.0  
**Repositório:** [abs-js/NilouLLM](https://github.com/abs-js/NilouLLM)

## API

**Endpoint:** `POST /`

**Request JSON:**
```json
{
  "q": "sua pergunta aqui",
  "m": "Nilou 0.0.0"
}
```

**Response JSON:**
```json
{
  "r": "resposta do modelo",
  "tokens": 42,
  "m": "Nilou 0.0.0"
}
```

- `q`: pergunta / entrada
- `m`: modelo (apenas `Nilou 0.0.0` por enquanto; padrão)
- `r`: resposta
- `tokens`: quantidade aproximada de tokens usados (entrada + saída)

Modo anti-alucinação e demais lógicas ficam **dentro do servidor** (o modelo só responde com base nos arquivos em `params/`).

## Como rodar

```bash
npm install
npm start
```

Depois:

```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"q":"o que é python?"}'
```

## Persistência

Interações são salvas automaticamente no Supabase via a API `db()`  
(tabela `nilou_logs`, chaves começando com `Nilou000_`).

## Estrutura

- `server.js` — servidor HTTP + API
- `src/model.js` — modelo Nilou (n-gram + ferramentas + modos)
- `src/db.js` — cliente do banco
- `params/` — base de conhecimento por tópico

**Nota:** Projeto educacional. O modelo prioriza não alucinar.  
Licença: MIT
