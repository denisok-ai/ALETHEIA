/**
 * Публикация постов в Telegram-канал (dry_run / auto).
 */
import { prisma } from '@/lib/db';
import { getTelegramAdminChatIds } from '@/lib/telegram-admin-notify';
import { sendTelegramMessageWithResult, sendTelegramPhotoWithResult } from '@/lib/telegram';
import { getContentConfig, isEffectiveDryRun, setContentSetting } from '../config';
import { normalizePostLexicon, scanPublishBlockers } from '../quality-gates';

const TG_LIMIT = 4096;

function splitText(text: string, limit = TG_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  let buf = '';
  for (const para of text.split('\n\n')) {
    const cand = buf ? `${buf}\n\n${para}` : para;
    if (cand.length <= limit) {
      buf = cand;
    } else {
      if (buf) parts.push(buf);
      if (para.length <= limit) buf = para;
      else {
        for (let i = 0; i < para.length; i += limit) parts.push(para.slice(i, i + limit));
        buf = '';
      }
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

export async function publishContentItem(itemId: string, force = false) {
  const item = await prisma.contentItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: 'not_found' };

  const raw = (item.finalText || item.generatedText || '').trim();
  if (!raw) return { ok: false, error: 'empty_text' };

  const text = normalizePostLexicon(raw);
  const blockers = scanPublishBlockers(text);
  if (blockers.length) {
    await prisma.contentItem.update({
      where: { id: itemId },
      data: { status: 'quality_failed', qualityIssues: JSON.stringify(blockers) },
    });
    return { ok: false, error: 'publish_blockers', blockers: blockers.map((b) => b.code) };
  }

  const config = await getContentConfig();
  if (config.paused && !force) return { ok: false, error: 'paused' };

  const dryRun = !force && (await isEffectiveDryRun(config));
  const adminIds = await getTelegramAdminChatIds();

  if (dryRun) {
    const preview = `<b>📝 Превью поста</b> (${item.postType})\n<b>Тема:</b> ${item.topic.slice(0, 100)}\n\n${text.slice(0, 3500)}${text.length > 3500 ? '…' : ''}\n\n<i>dry_run — /approve ${item.id.slice(0, 8)} или /auto</i>`;
    let sent = 0;
    for (const chatId of adminIds) {
      const r = await sendTelegramMessageWithResult(chatId, preview);
      if (r.ok) sent += 1;
    }
    await prisma.contentItem.update({ where: { id: itemId }, data: { status: 'ready' } });
    return { ok: true, dryRun: true, sent };
  }

  const channelId = config.contentChannelId;
  if (!channelId) return { ok: false, error: 'no_channel' };

  if (item.imageUrl) {
    const photo = await sendTelegramPhotoWithResult(channelId, item.imageUrl);
    if (!photo.ok) return { ok: false, error: photo.error };
  }

  for (const chunk of splitText(text)) {
    const r = await sendTelegramMessageWithResult(channelId, chunk);
    if (!r.ok) return { ok: false, error: r.error };
  }

  await prisma.contentItem.update({
    where: { id: itemId },
    data: { status: 'published', publishedAt: new Date() },
  });

  if (item.themeId) {
    await prisma.themePool.update({ where: { id: item.themeId }, data: { status: 'used' } }).catch(() => undefined);
  }

  return { ok: true, dryRun: false, channelId };
}

export async function publishDueToday(force = false) {
  const config = await getContentConfig();
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const items = await prisma.contentItem.findMany({
    where: {
      publishDate: { gte: start, lte: end },
      status: { in: ['ready', 'approved'] },
    },
    orderBy: { publishDate: 'asc' },
  });

  if (!items.length) return { published: 0, message: 'Нет постов на сегодня.' };

  let published = 0;
  for (const item of items) {
    const r = await publishContentItem(item.id, force);
    if (r.ok) published += 1;
  }
  return { published, dryRun: await isEffectiveDryRun(config) };
}

export async function approveItem(partialId: string) {
  const item = await prisma.contentItem.findFirst({
    where: { id: { startsWith: partialId }, status: { in: ['ready', 'quality_failed', 'dedup_blocked'] } },
  });
  if (!item) return { ok: false, error: 'not_found' };
  await prisma.contentItem.update({ where: { id: item.id }, data: { status: 'approved' } });
  return publishContentItem(item.id, true);
}

export async function setDryRunMode(on: boolean) {
  await setContentSetting('content_dry_run', on ? 'true' : 'false');
  if (on) await setContentSetting('content_auto_publish', 'false');
}

export async function setAutoMode(on: boolean) {
  await setContentSetting('content_auto_publish', on ? 'true' : 'false');
  if (on) await setContentSetting('content_dry_run', 'false');
}

export async function setPaused(on: boolean) {
  await setContentSetting('content_paused', on ? 'true' : 'false');
}

export async function formatPublishMode(): Promise<string> {
  const config = await getContentConfig();
  const dry = await isEffectiveDryRun(config);
  return [
    '<b>Режим публикации</b>',
    `dry_run: <b>${config.dryRun ? 'да' : 'нет'}</b>`,
    `auto_publish: <b>${config.autoPublish ? 'да' : 'нет'}</b>`,
    `paused: <b>${config.paused ? 'да' : 'нет'}</b>`,
    `канал: <code>${config.contentChannelId || 'не задан'}</code>`,
    `эффективно: <b>${dry ? 'dry_run (превью админам)' : 'авто в канал'}</b>`,
  ].join('\n');
}

export async function previewNextItem(): Promise<string> {
  const item = await prisma.contentItem.findFirst({
    where: { status: { in: ['ready', 'approved', 'planned'] } },
    orderBy: { publishDate: 'asc' },
  });
  if (!item) return 'Нет постов для превью.';
  const text = (item.finalText || item.generatedText || '(текст не сгенерирован)').slice(0, 3000);
  return `<b>Превью</b> · ${item.publishDate.toLocaleDateString('ru-RU')} · ${item.postType}\n<code>${item.id.slice(0, 8)}</code>\n\n${text}`;
}
