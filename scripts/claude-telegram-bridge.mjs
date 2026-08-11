#!/usr/bin/env node
/**
 * Telegram-мост к Claude Code НА ЭТОМ КОМПЬЮТЕРЕ.
 *
 * Владелец пишет боту с телефона — сообщение уходит в `claude -p` в каталоге
 * проекта на этой машине, ответ возвращается в чат. Диалог непрерывен
 * (session resume), терминал на телефоне не нужен.
 *
 * ВАЖНО: это НЕ прод-бот школы. Токен — отдельный бот из @BotFather; прод-бот
 * трогать нельзя (два long-poll на одном токене конфликтуют по getUpdates).
 *
 * Конфиг: ~/.claude-bridge.env (chmod 600), формат KEY=VALUE:
 *   BRIDGE_BOT_TOKEN=123456:ABC...            (обязателен)
 *   BRIDGE_ALLOWED_CHAT_ID=337952743          (кто имеет доступ; по умолчанию Denis)
 *   BRIDGE_PROJECT_DIR=/home/denisok/projects/AVATERRA
 *   BRIDGE_SKIP_PERMISSIONS=1                 (1 = --dangerously-skip-permissions;
 *                                              иначе --permission-mode acceptEdits)
 *
 * Запуск:  node scripts/claude-telegram-bridge.mjs
 * Фоново:  tmux new-session -d -s bridge 'node scripts/claude-telegram-bridge.mjs'
 * Состояние (offset + id сессии): ~/.claude-bridge-state.json
 *
 * Команды в чате: /new — начать новую сессию Claude; /status — что запущено.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { homedir } from 'os';
import path from 'path';

const ENV_FILE = path.join(homedir(), '.claude-bridge.env');
const STATE_FILE = path.join(homedir(), '.claude-bridge-state.json');
const CLAUDE_TIMEOUT_MS = 45 * 60 * 1000;

function loadEnvFile(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const cfg = { ...loadEnvFile(ENV_FILE), ...process.env };
const TOKEN = cfg.BRIDGE_BOT_TOKEN;
const ALLOWED_CHAT = String(cfg.BRIDGE_ALLOWED_CHAT_ID || '337952743');
const PROJECT_DIR = cfg.BRIDGE_PROJECT_DIR || '/home/denisok/projects/AVATERRA';
const SKIP_PERMISSIONS = cfg.BRIDGE_SKIP_PERMISSIONS === '1';

if (!TOKEN) {
  console.error(`Нет BRIDGE_BOT_TOKEN. Создайте бота в @BotFather и запишите токен в ${ENV_FILE}`);
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { offset: 0, sessionId: null };
  }
}
let state = loadState();
function saveState() {
  writeFileSync(STATE_FILE, JSON.stringify(state));
}

async function tg(method, body) {
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return r.json();
}

async function reply(chatId, text) {
  // Telegram ограничивает сообщение 4096 символами — режем по абзацам.
  const chunks = [];
  let buf = '';
  for (const para of String(text || '(пустой ответ)').split('\n')) {
    const cand = buf ? `${buf}\n${para}` : para;
    if (cand.length <= 4000) buf = cand;
    else {
      if (buf) chunks.push(buf);
      if (para.length <= 4000) buf = para;
      else {
        for (let i = 0; i < para.length; i += 4000) chunks.push(para.slice(i, i + 4000));
        buf = '';
      }
    }
  }
  if (buf) chunks.push(buf);
  for (const c of chunks) {
    await tg('sendMessage', { chat_id: chatId, text: c });
  }
}

function runClaude(prompt) {
  return new Promise((resolve) => {
    const args = ['-p', prompt, '--output-format', 'json'];
    if (state.sessionId) args.push('--resume', state.sessionId);
    if (SKIP_PERMISSIONS) args.push('--dangerously-skip-permissions');
    else args.push('--permission-mode', 'acceptEdits');

    const child = spawn('claude', args, {
      cwd: PROJECT_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, CLAUDE_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(out);
        if (parsed.session_id) {
          state.sessionId = parsed.session_id;
          saveState();
        }
        resolve(parsed.result ?? parsed.error ?? '(нет result в ответе)');
      } catch {
        resolve(
          `Claude завершился с кодом ${code}.\n${(err || out || '').slice(0, 3000)}`
        );
      }
    });
  });
}

let busy = false;

async function handleMessage(msg) {
  const chatId = String(msg.chat?.id ?? '');
  const text = (msg.text ?? '').trim();
  if (chatId !== ALLOWED_CHAT) {
    console.warn(`Отказ: сообщение от чужого chat_id ${chatId}`);
    return;
  }
  if (!text) return;

  if (text === '/new') {
    state.sessionId = null;
    saveState();
    await reply(chatId, 'Начал новую сессию Claude. Пишите задачу.');
    return;
  }
  if (text === '/status' || text === '/start') {
    await reply(
      chatId,
      [
        'Мост к Claude Code на домашнем компе.',
        `Проект: ${PROJECT_DIR}`,
        `Сессия: ${state.sessionId ?? 'новая (начнётся с первого сообщения)'}`,
        `Права: ${SKIP_PERMISSIONS ? 'без подтверждений' : 'acceptEdits'}`,
        busy ? 'Сейчас: выполняю задачу…' : 'Сейчас: свободен.',
        'Команды: /new — новая сессия, /status — это сообщение.',
      ].join('\n')
    );
    return;
  }

  if (busy) {
    await reply(chatId, '⏳ Ещё выполняю предыдущую задачу — отвечу, как закончу, и возьму эту.');
    // Не выходим: обработка последовательная, очередь обеспечивает основной цикл.
  }

  busy = true;
  await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
  try {
    const result = await runClaude(text);
    await reply(chatId, result);
  } catch (e) {
    await reply(chatId, `Ошибка моста: ${e?.message ?? e}`);
  } finally {
    busy = false;
  }
}

async function main() {
  const me = await tg('getMe');
  if (!me.ok) {
    console.error('Токен не работает:', JSON.stringify(me));
    process.exit(1);
  }
  console.log(`Мост запущен: @${me.result.username}; проект ${PROJECT_DIR}; чат ${ALLOWED_CHAT}`);

  for (;;) {
    try {
      const upd = await tg('getUpdates', {
        offset: state.offset,
        timeout: 50,
        allowed_updates: ['message'],
      });
      if (!upd.ok) {
        console.error('getUpdates:', JSON.stringify(upd).slice(0, 200));
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      for (const u of upd.result) {
        state.offset = u.update_id + 1;
        saveState();
        if (u.message) await handleMessage(u.message);
      }
    } catch (e) {
      console.error('Цикл:', e?.message ?? e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main();
