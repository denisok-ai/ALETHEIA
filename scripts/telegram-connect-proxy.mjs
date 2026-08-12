#!/usr/bin/env node
/**
 * Минимальный HTTP CONNECT-прокси ТОЛЬКО для Telegram-доменов.
 *
 * Зачем: с 03.08.2026 у прод-VPS нет выхода к Telegram (умерла VPN-подписка
 * владельца, WARP и Tor душатся DPI). С домашней машины Telegram доступен
 * напрямую — прокси слушает 127.0.0.1:3129 здесь, а VPS достаёт его через
 * обратный SSH-туннель (127.0.0.1:18081 на VPS → сюда). Это ВРЕМЕННЫЙ мост до
 * восстановления нормального VPN-канала владельцем.
 *
 * Безопасность: слушает только loopback; проксирует только CONNECT и только на
 * домены из белого списка — даже при компрометации VPS открытым релеем не станет.
 *
 * Запуск держит scripts/telegram-egress-home.sh (tmux + автоперезапуск).
 */
import net from 'net';
import http from 'http';

const PORT = 3129;
const ALLOWED_SUFFIXES = [
  'telegram.org', // api.telegram.org и др.
  't.me', // веб-версия канала для импорта в блог
  'telesco.pe', // CDN фотографий постов
  'cdn-telegram.org',
];

function allowed(host) {
  const h = String(host).toLowerCase().replace(/\.$/, '');
  return ALLOWED_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

const server = http.createServer((req, res) => {
  res.writeHead(405);
  res.end('CONNECT only');
});

server.on('connect', (req, clientSocket, head) => {
  const [host, portStr] = String(req.url).split(':');
  const port = Number(portStr) || 443;
  if (!allowed(host) || port !== 443) {
    console.log(`deny ${req.url}`);
    clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    return;
  }
  const upstream = net.connect(port, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head?.length) upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  const drop = () => {
    upstream.destroy();
    clientSocket.destroy();
  };
  upstream.on('error', drop);
  clientSocket.on('error', drop);
  upstream.setTimeout(120_000, drop);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`telegram-connect-proxy on 127.0.0.1:${PORT}; allowed: ${ALLOWED_SUFFIXES.join(', ')}`);
});
