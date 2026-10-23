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
  "r": "your text or question",
  "t": "Response",
  "l": "en_US",
  "m": "Nilou 0.0.0"
}
```

**Response JSON:**
```json
{
  "r": "model output",
  "tokens": 42,
  "m": "Nilou 0.0.0",
  "t": "Response",
  "l": "en_US"
}
```

| Field | Description |
|-------|-------------|
| `r`  | Input text (was previously called `q`) |
| `t`  | Command type: `Response` (default) or `NextWord` |
| `l`  | Language: `en_US` (default) or `pt_BR` |
| `m`  | Model name (only `Nilou 0.0.0` for now) |
| `tokens` | Approximate tokens used |

- `t: "Response"` → full answer
- `t: "NextWord"` → predicts the next word + confidence

Anti-hallucination logic stays inside the server.

## Dashboard

Open the root URL to see the real-time dashboard:
- Requests / minute
- Tokens / minute & / second
- Daily requests
- Charts + recent requests table

## Run locally

```bash
npm install
npm start
```

Then open http://localhost:3000

## Render

This project is ready for Render:
- Uses `process.env.PORT`
- Start command: `npm start`
- No extra build step needed

## Persistence

Interactions are saved to Supabase (table `nilou_logs`, keys starting with `Nilou000_`).

**License:** MIT
