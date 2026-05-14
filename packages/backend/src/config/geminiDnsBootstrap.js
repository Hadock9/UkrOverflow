/**
 * Завантаження .env + налаштування DNS для Gemini **до** будь-яких HTTPS-запитів.
 * Імпортуйте цей файл першим з gemini.js / geminiRestClient.js.
 */
import dns from 'node:dns';
import dotenv from 'dotenv';

dotenv.config();

if (process.env.GEMINI_IPv4_FIRST !== '0' && process.env.GEMINI_IPv4_FIRST !== 'false') {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    /* ignore */
  }
}

// Якщо getaddrinfo ENOTFOUND generativelanguage.googleapis.com — задайте публічні DNS (див. .env.example)
const dnsServers = process.env.GEMINI_DNS_SERVERS?.trim();
if (dnsServers) {
  try {
    const list = dnsServers.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    if (list.length) {
      dns.setServers(list);
      if (process.env.NODE_ENV === 'development') {
        console.log('[Gemini] DNS для процесу Node:', dns.getServers().join(', '));
      }
    }
  } catch (e) {
    console.warn('[Gemini] Некоректний GEMINI_DNS_SERVERS:', e.message);
  }
}
