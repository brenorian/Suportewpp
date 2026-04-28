const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// =============================================
// CONFIGURAÇÕES — preencha no Render (Env Vars)
// =============================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL; // ex: https://sua-evolution.onrender.com
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE; // nome da instância criada
const CHATWOOT_URL = process.env.CHATWOOT_URL || null;     // opcional, pra escalada humana
const CHATWOOT_TOKEN = process.env.CHATWOOT_TOKEN || null; // opcional

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
// MEMÓRIA DE CONVERSAS (em memória — simples)
// =============================================
const conversas = new Map();

function getHistorico(telefone) {
  if (!conversas.has(telefone)) {
    conversas.set(telefone, []);
  }
  return conversas.get(telefone);
}

function adicionarMensagem(telefone, role, texto) {
  const historico = getHistorico(telefone);
  historico.push({ role, parts: [{ text: texto }] });
  // Mantém só as últimas 20 mensagens pra não explodir o contexto
  if (historico.length > 20) historico.splice(0, 2);
}

// =============================================
// GEMINI — gera resposta
// =============================================
async function gerarResposta(telefone, mensagemUsuario) {
  adicionarMensagem(telefone, "user", mensagemUsuario);
  const historico = getHistorico(telefone);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: historico,
  };

  const response = await axios.post(url, body);
  const resposta = response.data.candidates[0].content.parts[0].text;

  adicionarMensagem(telefone, "model", resposta);
  return resposta;
}

// =============================================
// EVOLUTION API — envia mensagem
// =============================================
async function enviarMensagem(telefone, texto) {
  await axios.post(
    `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
    { number: telefone, text: texto },
    { headers: { apikey: EVOLUTION_API_KEY } }
  );
}

// =============================================
// ESCALADA HUMANA — detecta e notifica
// =============================================
function precisaHumano(texto) {
  const gatilhos = [
    "falar com humano",
    "atendente",
    "quero falar com alguém",
    "transferir",
    "problema sério",
    "não estou conseguindo",
    "urgente",
  ];
  return gatilhos.some((g) => texto.toLowerCase().includes(g));
}

// =============================================
// WEBHOOK — recebe mensagens do WhatsApp
// =============================================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // responde rápido pra Evolution API não retentar

  try {
    const evento = req.body;

    // Ignora eventos que não são mensagens de texto
    if (evento.event !== "messages.upsert") return;
    const msg = evento.data?.message;
    if (!msg) return;

    // Ignora mensagens do próprio bot
    if (msg.key?.fromMe) return;

    const telefone = msg.key?.remoteJid;
    const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

    if (!texto || !telefone) return;

    console.log(`📩 [${telefone}]: ${texto}`);

    // Verifica se quer humano antes de chamar IA
    if (precisaHumano(texto)) {
      await enviarMensagem(
        telefone,
        "Entendido! Vou te transferir para um atendente agora mesmo. Aguarda um instante 🙂"
      );
      // Aqui você pode integrar o Chatwoot futuramente
      console.log(`🚨 Escalada humana solicitada por ${telefone}`);
      return;
    }

    // Gera resposta via Gemini
    const resposta = await gerarResposta(telefone, texto);
    await enviarMensagem(telefone, resposta);

    console.log(`✅ Respondido [${telefone}]: ${resposta.substring(0, 80)}...`);
  } catch (err) {
    console.error("❌ Erro no webhook:", err.message);
  }
});

// Health check pro Render
app.get("/", (req, res) => res.json({ status: "bot online ✅" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Bot rodando na porta ${PORT}`));
