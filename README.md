# Nilou 0.0.0

Basic language model built **from absolute zero** in pure JavaScript (no neural network libraries).

**Agent name:** Nilou  
**Version:** 0.0.0  
**Repository:** [abs-js/NilouLLM](https://github.com/abs-js/NilouLLM)

## API

**Endpoint:** `POST /`

**Request JSON:**
```json
{
  "q": "your question here",
  "m": "Nilou 0.0.0",
  "l": "en_US"
}
```

**Response JSON:**
```json
{
  "r": "model response",
  "tokens": 42,
  "m": "Nilou 0.0.0"
}
```

- `q`: question / input
- `m`: model (only `Nilou 0.0.0` for now; default)
- `l`: language — `en_US` (default) or `pt_BR`
- `r`: response
- `tokens`: approximate number of tokens used (input + output)

Anti-hallucination mode and other logic stay **inside the server** (the model only answers based on files in `params/`).

## How to run

```bash
npm install
npm start
```

Then:

```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"q":"what is python?","l":"en_US"}'
```

## Persistence

Interactions are automatically saved to Supabase via the `db()` API  
(table `nilou_logs`, keys starting with `Nilou000_`).

## Structure

- `server.js` — HTTP server + API
- `src/model.js` — Nilou model (n-gram + tools + modes)
- `src/db.js` — database client
- `params/` — knowledge base by topic

**Note:** Educational project. The model prioritizes not hallucinating.  
License: MIT
