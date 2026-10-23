# Nilou 0.0.0

Basic language model from scratch in pure JavaScript.

## API

**POST /**

```json
{
  "m": "Nilou 0.0.0",
  "q": "your question",
  "c": { "maxTokens": 80 }
}
```

**Response:**

```json
{
  "r": "generated text until </s>",
  "t": 42
}
```

- Always generates by predicting the next word until `</s>` appears.
- Token ceiling per request.
- Rate limit: 30 requests per minute.

## Knowledge base format

- New lines: `\n`
- Code blocks: `-code:language\n...\ncode-`
- End of answer: `</s>`

## Run

```bash
node server.js "seu_token"
```

Auto-training starts after 5 minutes of inactivity.
