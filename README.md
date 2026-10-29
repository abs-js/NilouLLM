# Nilou 0.0.0

Modelo de linguagem básico e **mais pensativo** em JavaScript puro.

## Melhorias recentes
- **Quintgramas (n=5)** por padrão + blend de **quadrigramas (n=4)** com pesos diferentes
- Seleção inteligente de frase-semente (fase pensativa)
- Sampling com temperatura
- Parada antecipada para consumir menos tokens
- Melhor pontuação de tópicos

## API

**POST /**

```json
{
  "k": "sua_chave",
  "q": "sua pergunta",
  "c": { "maxTokens": 60 }
}
```

**Response:**

```json
{
  "r": "texto gerado até </s>",
  "t": 28,
  "topic": "python"
}
```

- Gera por predição de próxima palavra até `</s>` ou confiança baixa.
- Limite de tokens por request (padrão mais baixo).
- Rate limit: 30 requests por minuto.

## Formato da base de conhecimento

- Novas linhas: `\n`
- Blocos de código: `-code:language\n...\ncode-`
- Fim da resposta: `</s>`

## Testes

Edite `tests/test.js` e coloque sua pergunta e token:

```bash
node tests/test.js
```

## Run

```bash
node server.js "seu_token"
```

O modelo agora é mais seletivo na escolha do contexto e tende a respostas mais curtas e relevantes.
