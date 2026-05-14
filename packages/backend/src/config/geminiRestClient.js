/**
 * Прямий HTTPS виклик Gemini REST API (обхід undici fetch у @google/generative-ai,
 * який на частині мереж дає лише "fetch failed").
 */
import './geminiDnsBootstrap.js';
import https from 'node:https';

const GEMINI_HOST = 'generativelanguage.googleapis.com';

function getApiKey() {
  const k = process.env.GEMINI_API_KEY?.trim();
  if (!k) {
    throw new Error(
      'Відсутній GEMINI_API_KEY у .env (packages/backend). Додайте ключ: https://aistudio.google.com/apikey'
    );
  }
  return k;
}

function getTimeoutMs() {
  return Math.max(5000, parseInt(process.env.GEMINI_REQUEST_TIMEOUT || '180000', 10) || 180000);
}

function getApiVersion() {
  return (process.env.GEMINI_API_VERSION?.trim() || 'v1beta').replace(/^\/+/, '');
}

function shouldForceIpv4() {
  return process.env.GEMINI_FORCE_IPV4 !== '0' && process.env.GEMINI_FORCE_IPV4 !== 'false';
}

/**
 * @param {object} opts
 * @param {string} opts.model - напр. gemini-2.5-flash
 * @param {object} opts.body - { contents, safetySettings?, generationConfig? }
 * @returns {Promise<object>} сирий JSON відповіді Gemini
 */
export function geminiGenerateContent({ model, body }) {
  const apiKey = getApiKey();
  const apiVersion = getApiVersion();
  const timeoutMs = getTimeoutMs();
  const path = `/${apiVersion}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = JSON.stringify(body);

  const agent = shouldForceIpv4()
    ? new https.Agent({ family: 4, keepAlive: true })
    : new https.Agent({ keepAlive: true });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: GEMINI_HOST,
        port: 443,
        method: 'POST',
        path,
        agent,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            const json = raw ? JSON.parse(raw) : {};
            if (res.statusCode && res.statusCode >= 400) {
              const msg = json?.error?.message || raw?.slice(0, 400) || `HTTP ${res.statusCode}`;
              reject(new Error(msg));
              return;
            }
            resolve(json);
          } catch (e) {
            reject(new Error(`Некоректна відповідь Gemini (${res.statusCode}): ${raw?.slice(0, 300)}`));
          }
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Таймаут з’єднання з Gemini (${timeoutMs} мс)`));
    });
    req.on('error', (err) => {
      const code = err?.code;
      const msg = err?.message || String(err);
      if (code === 'ENOTFOUND' || msg.includes('ENOTFOUND')) {
        reject(
          new Error(
            `${msg} — додайте у packages/backend/.env рядок GEMINI_DNS_SERVERS=8.8.8.8,8.8.4.4 (або DNS вашого провайдера) і перезапустіть backend.`,
            { cause: err }
          )
        );
        return;
      }
      reject(err);
    });
    req.write(payload);
    req.end();
  });
}

/**
 * Текст першої відповіді моделі (аналог response.text() у SDK).
 */
export function textFromGeminiResponse(json) {
  const feedback = json?.promptFeedback;
  if (feedback?.blockReason) {
    const msg = feedback.blockReasonMessage || feedback.blockReason;
    throw new Error(`Запит заблоковано: ${msg}`);
  }

  const candidate = json?.candidates?.[0];
  if (!candidate) {
    throw new Error('Відповідь без candidates (перевірте ключ і квоту API)');
  }

  const bad = ['SAFETY', 'RECITATION', 'LANGUAGE'];
  if (candidate.finishReason && bad.includes(String(candidate.finishReason))) {
    const fm = candidate.finishMessage ? `: ${candidate.finishMessage}` : '';
    throw new Error(`Відповідь відхилено (${candidate.finishReason})${fm}`);
  }

  const parts = candidate.content?.parts;
  if (!parts?.length) {
    throw new Error('Порожній текст відповіді від моделі');
  }

  return parts.map((p) => p.text).filter(Boolean).join('');
}
