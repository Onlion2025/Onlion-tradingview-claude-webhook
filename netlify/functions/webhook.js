const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { symbol='UNBEKANNT', price=0, support=0, resist=0, trend='neutral', rsi=50, volume='normal', capital=10000, risk=2 } = JSON.parse(event.body || '{}');

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: `Analysiere: ${symbol} Kurs:$${price} Support:$${support} Widerstand:$${resist} Trend:${trend} RSI:${rsi} Kapital:$${capital} Risiko:${risk}% Antworte NUR mit JSON: {"signal":"LONG/SHORT/WARTEN","confidence":0-100,"entry":0,"sl":0,"tp1":0,"tp2":0,"positionSize":0,"riskReward":0.0,"reasoning":"Deutsch"}` }]
    });

    const signal = JSON.parse(msg.content[0].text.replace(/```json|```/g,'').trim());
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, signal, timestamp: new Date().toISOString() }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
