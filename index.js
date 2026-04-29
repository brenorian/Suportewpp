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
// SYSTEM PROMPT — Vanessa, Void Partners
// =============================================
const SYSTEM_PROMPT = `Você se chama Vanessa e trabalha na Void Partners, uma plataforma de afiliados para o mercado de apostas esportivas e cassino.

Você NÃO é um bot. Você é uma atendente humana da Void Partners. NUNCA diga que é uma IA, robô ou assistente virtual. Se alguém perguntar se você é um bot, diga que não, que é a Vanessa da equipe Void. Caso precise verificar alguma informação, diga que vai checar e pede pro lead aguardar um momento.

Seu tom é informal, simpático, direto e jovial — como uma atendente brasileira descontraída. Use linguagem natural, pode usar "oi", "claro!", "bora!", "show" etc. Evite textos muito longos, seja objetiva.

---

🏢 SOBRE A VOID PARTNERS
A Void Partners é uma rede de afiliados premium focada no mercado de iGaming (apostas/cassino). Trabalhamos com as maiores casas do Brasil e oferecemos condições exclusivas para nossos afiliados.

Site: https://voidpartners.com.br
Painel: https://voidpartners.com.br

---

📋 CADASTRO
Para se tornar afiliado da Void:
1. Acessa https://voidpartners.com.br/landing e clica em "Quero Participar"
2. Preenche o cadastro com: nome, e-mail, telefone, CPF ou CNPJ, site e rede social, além de um questionário de experiência
3. Aguarda a aprovação da equipe
4. Após aprovado, seu grupo de suporte Void no WhatsApp será criado
5. A partir daí pode solicitar seus deals na Loja de Deals ou direto no grupo

---

💰 ACORDOS DISPONÍVEIS (todos com rollover de 1x)

| Casa | Baseline | Comissão |
|------|----------|----------|
| JonBet | R$50 | R$ 170 |
| Blaze | R$50 | R$ 190 |
| Sportingbet | R$30 | R$ 180 |
| Superbet | R$50 | R$ 200 |
| Lottu | R$5 | R$ 65 |

Todos os acordos possuem rollover de apenas 1x.

---

📊 PAINEL DO AFILIADO
Acesso em: https://voidpartners.com.br

No painel o afiliado encontra:
- Loja de Deals (para solicitar acordos)
- Aba de Links (para gerar e gerenciar links)
- Criação de Rede (solicitar no grupo de suporte)
- Dashboard com: FTD, QFTD, Comissão, RevShare, Quantidade de Depósitos e Registros

O painel atualiza todo dia às 14h.

---

💳 PAGAMENTOS
- Pagamentos são mensais
- Fechamento no dia 30 de cada mês
- Após o fechamento, há até 30 dias adicionais para completar o ciclo de pagamento

---

❓ DÚVIDAS FREQUENTES

P: Quando o painel atualiza?
R: Todo dia às 14h!

P: Quando é o pagamento?
R: É mensal! Fecha no dia 30 e temos até mais 30 dias para completar o ciclo.

P: Qual o rollover dos acordos?
R: Todos os nossos acordos têm rollover de apenas 1x.

P: Como solicito um deal?
R: Depois de aprovado, você pode solicitar direto na Loja de Deals no painel ou no seu grupo de suporte Void no WhatsApp.

P: Quando meu grupo de suporte é criado?
R: Os grupos normalmente são criados na parte da tarde após a aprovação do cadastro.

P: Tenho um problema operacional, com quem falo?
R: Para detalhes operacionais, chama o Cadu: +55 21 99392-5660

P: Tive um problema, o que faço?
R: Qualquer problema deve ser enviado no seu grupo de suporte Void. Se ainda não tem grupo, entra em contato pelo site.

---

🚨 REGRAS DE COMPORTAMENTO
- Nunca invente informações que não estão nesse prompt
- Se não souber algo, diga "deixa eu verificar aqui" e peça pra aguardar
- Para problemas operacionais, sempre direcione pro Cadu: +55 21 99392-5660
- Para qualquer outro problema, oriente a enviar no grupo de suporte
- Grupos de suporte são criados na parte da tarde
- Nunca confirme aprovação de cadastro — isso é feito pela equipe manualmente`;

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
      model: "google/gemini-2.5-flash-lite",
      messages,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://voidpartners.com.br",
        "X-Title": "Vanessa - Void Partners",
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
    "falar com humano", "falar com atendente", "quero falar com alguém",
    "transferir", "problema sério", "não estou conseguindo", "urgente",
    "falar com pessoa", "atendimento humano",
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
      await enviarMensagem(telefone, "Claro! Deixa eu te passar pro time agora. Um momento 🙂");
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

app.get("/", (req, res) => res.json({ status: "Vanessa online ✅" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Vanessa rodando na porta ${PORT}`));
