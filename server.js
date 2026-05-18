// ============================================================
//  TradingView → Claude KI Trading Signal Server
//  Deploy auf render.com (kostenlos)
// ============================================================

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());

// Anthropic Client (API Key aus Environment Variable)
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Optional: Telegram Benachrichtigung
const TG_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;  // optional
const TG_CHAT   = process.env.TELEGRAM_CHAT_ID;     // optional

// ── Telegram Helper ──────────────────────────────────────────
async function sendTelegram(signal, symbol) {
  if (!TG_TOKEN || !TG_CHAT) return;
  const icon = signal.signal === 'LONG' ? '🟢' : signal.signal === 'SHORT' ? '🔴' : '🟡';
  const text = [
    `${icon} *${signal.signal}* – ${symbol}`,
    `Konfidenz: ${signal.confidence}%`,
    `Einstieg: $${signal.entry}`,
    `Stop-Loss: $${signal.sl}`,
    `Take-Profit 1: $${signal.tp1}`,
    `Take-Profit 2: $${signal.tp2}`,
    `Positionsgröße: $${signal.positionSize}`,
    `Risk/Reward: ${signal.riskReward}:1`,
    ``,
    `📝 ${signal.reasoning}`
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'Markdown' })
    });
    console.log('Telegram-Nachricht gesendet.');
  } catch (err) {
    console.error('Telegram-Fehler:', err.message);
  }
}

// ── Webhook Endpoint ─────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  const {
    symbol   = 'UNBEKANNT',
    price    = 0,
    support  = 0,
    resist   = 0,
    trend    = 'neutral',
    rsi      = 50,
    volume   = 'normal',
    capital  = 10000,
    risk     = 2
  } = req.body;

  console.log(`[Webhook] ${symbol} @ $${price} | Trend: ${trend}`);

  const prompt = `Du bist ein erfahrener technischer Analyst. Analysiere folgendes Setup und gib ein präzises Trading-Signal.

Asset: ${symbol}
Aktueller Kurs: $${price}
Support: $${support}
Widerstand: $${resist}
Trend: ${trend}
RSI: ${rsi}
Volumen: ${volume}
Kapital: $${capital}
Risiko pro Trade: ${risk}%

Antworte NUR mit einem JSON-Objekt, ohne Markdown, ohne Backticks:
{
  "signal": "LONG" oder "SHORT" oder "WARTEN",
  "confidence": Zahl 1-100,
  "entry": Einstiegskurs als Zahl,
  "sl": Stop-Loss Kurs als Zahl,
  "tp1": Take-Profit 1 als Zahl,
  "tp2": Take-Profit 2 als Zahl,
  "positionSize": Positionsgröße in Dollar als Zahl,
  "riskReward": Risk-Reward-Ratio als Zahl,
  "reasoning": "2-3 Sätze Begründung auf Deutsch"
}`;

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    const raw    = msg.content.map(b => b.text || '').join('');
    const clean  = raw.replace(/```json|```/g, '').trim();
    const signal = JSON.parse(clean);

    console.log(`[Signal] ${signal.signal} | Entry: ${signal.entry} | RR: ${signal.riskReward}`);

    // Telegram senden (falls konfiguriert)
    await sendTelegram(signal, symbol);

    res.json({ success: true, signal, timestamp: new Date().toISOString() });

  } catch (err) {
    console.error('[Fehler]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Health Check ─────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Server Start ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`Webhook: POST /webhook`);
  console.log(`Health:  GET  /health`);
});
