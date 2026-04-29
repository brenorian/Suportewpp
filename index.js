const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// =============================================
// CONFIGURAÇÕES — variáveis de ambiente
// =============================================
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

const ZAPI_BASE = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;

// =============================================
// SYSTEM PROMPT — personalize com seu programa
// =============================================
const SYSTEM_PROMPT = `Você é o assistente virtual de afiliados da Moskitao Agency Digital.
Seu papel é atender afiliados com cordialidade, clareza e agilidade.

Você pode ajudar com:
- Dúvidas sobre o programa de afiliados (comissões, regras, prazos de pagamento)
- Como acessar o painel de afiliados
- Status de links e campanhas
- Como gerar e usar links de afiliado
- Dúvidas sobre materiais de divulgação

Regras importantes:
- Seja sempre simpático e profissional
- Responda em português brasileiro
- Se não souber a resposta, diga que vai verificar e peça para aguardar
- Se o afiliado estiver com problema técnico sério ou quiser falar com humano, diga: "Vou te transferir para um atendente agora mesmo! Aguarda um instante 🙂"
- NUNCA invente informações sobre comissões ou pagamentos
- Mensagens curtas e diretas, sem enrolação

Informações do programa (atualize conforme necessário):
- Comissão: [PREENCHA AQUI — ex: 30% por venda]
- Prazo de pagamento: [PREENCHA AQUI — ex: todo dia 15]
- Painel do afiliado: [PREENCHA AQUI — URL do painel]
- Suporte humano: [PREENCHA AQUI — ex: seg a sex, 9h às 18h]`;

// =============================================
// MEMÓRIA DE CONVERSAS
// =============================================
const conversas = new Map();

function getHistorico(telefone) {
  if (!conversas.has(telefone)) conversas.set(telefone, []);
  return conversas.get(telefone);
}

function adicionarMensagem(telefone, role, texto) {
  const historico = getHistorico(telefone);
  historico.push({ role, content: texto });
  if (historico.length > 20) historico.splice(0, 2);
}

// =============================================
// OPENROUTER — gera resposta
// =============================================
async function gerarResposta(telefone, mensagemUsuario) {
  adicionarMensagem(telefone, "user", mensagemUsuario);
  const historico = getHistorico(telefone);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...historico,
  ];

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "google/gemini-2.5-flash-preview-05-20",
      messages,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://moskitao.com.br",
        "X-Title": "Moskitao Bot",
      },
    }
  );

  const resposta = response.data.choices[0].message.content;
  adicionarMensagem(telefone, "assistant", resposta);
  return resposta;
}

// =============================================
// Z-API — envia mensagem
// =============================================
async function enviarMensagem(telefone, texto) {
  await axios.post(
    `${ZAPI_BASE}/send-text`,
    { phone: telefone, message: texto },
    { headers: { "Client-Token": ZAPI_CLIENT_TOKEN } }
  );
}

// =============================================
// ESCALADA HUMANA
// =============================================
function precisaHumano(texto) {
  const gatilhos = [
    "falar com humano", "atendente", "quero falar com alguém",
    "transferir", "problema sério", "não estou conseguindo", "urgente",
  ];
  return gatilhos.some((g) => texto.toLowerCase().includes(g));
}

// =============================================
// WEBHOOK — recebe mensagens da Z-API
// =============================================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const evento = req.body;

    if (evento.fromMe) return;

    const texto = evento.text?.message || evento.body;
    const telefone = evento.phone;

    if (!texto || !telefone) return;

    console.log(`📩 [${telefone}]: ${texto}`);

    if (precisaHumano(texto)) {
      await enviarMensagem(telefone, "Entendido! Vou te transferir para um atendente agora mesmo. Aguarda um instante 🙂");
      console.log(`🚨 Escalada humana solicitada por ${telefone}`);
      return;
    }

    const resposta = await gerarResposta(telefone, texto);
    await enviarMensagem(telefone, resposta);
    console.log(`✅ Respondido [${telefone}]: ${resposta.substring(0, 80)}...`);
  } catch (err) {
    console.error("❌ Erro no webhook:", err.message);
    if (err.response) {
      console.error("Detalhes:", JSON.stringify(err.response.data));
    }
  }
});

app.get("/", (req, res) => res.json({ status: "bot online ✅" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Bot rodando na porta ${PORT}`));
