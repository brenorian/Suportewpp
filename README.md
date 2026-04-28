# 🤖 Bot WhatsApp Afiliados — Moskitao Agency

Bot de atendimento automático via WhatsApp usando Gemini AI + Evolution API + Render.

---

## Pré-requisitos

- Conta no Google AI Studio (chave Gemini): https://aistudio.google.com
- Conta no GitHub: https://github.com
- Conta no Render: https://render.com
- Número de WhatsApp dedicado pro bot

---

## PASSO 1 — Suba o código no GitHub

1. Crie um repositório novo no GitHub (pode ser privado)
2. Faça upload de todos os arquivos desta pasta
3. NÃO suba o arquivo .env (já está no .gitignore)

---

## PASSO 2 — Suba a Evolution API no Render

1. No Render: New > Web Service
2. Em "Image URL" use: atendai/evolution-api:latest
3. Em Environment Variables adicione:
   AUTHENTICATION_API_KEY=crie_uma_senha_forte_aqui
4. Aguarde o deploy e anote a URL (ex: https://evolution-xyz.onrender.com)

---

## PASSO 3 — Suba o Bot no Render

1. No Render: New > Web Service
2. Conecte o GitHub e selecione este repositório
3. Build Command: npm install
4. Start Command: npm start
5. Environment Variables:

   GEMINI_API_KEY           = sua chave do Google AI Studio
   EVOLUTION_API_URL        = URL da Evolution API (passo 2)
   EVOLUTION_API_KEY        = a senha que você criou (passo 2)
   EVOLUTION_INSTANCE       = afiliados

6. Aguarde e anote a URL do bot (ex: https://bot-afiliados.onrender.com)

---

## PASSO 4 — Conecte o WhatsApp

Crie a instância (rode no terminal ou Postman):

  POST https://SUA-EVOLUTION.onrender.com/instance/create
  Header: apikey: SUA_API_KEY
  Body: {"instanceName": "afiliados", "qrcode": true}

Escaneie o QR:
  Acesse: https://SUA-EVOLUTION.onrender.com/instance/connect/afiliados

Configure o Webhook:
  POST https://SUA-EVOLUTION.onrender.com/webhook/set/afiliados
  Header: apikey: SUA_API_KEY
  Body: {
    "url": "https://SEU-BOT.onrender.com/webhook",
    "webhook_by_events": false,
    "events": ["messages.upsert"]
  }

---

## PASSO 5 — Personalize o bot

Edite o SYSTEM_PROMPT em src/index.js com as informações do seu programa:
- Porcentagem de comissão
- Prazo de pagamento
- URL do painel
- Horário do suporte humano

---

## Estrutura do projeto

  whatsapp-bot/
  ├── src/
  │   └── index.js       <- Código principal
  ├── .env.example       <- Modelo das variáveis
  ├── .gitignore
  ├── package.json
  └── README.md
