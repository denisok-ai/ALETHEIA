/**
 * Админ-команды SMM / Site Radar / KB для Telegram-бота AVATERRA.
 */
import type { BotContext } from './types';
import { botReply } from './messaging';
import { contentMainMenuKeyboard } from './keyboards';
import { applyKbFromFile, getBrandProfile } from '@/lib/content/brand-kb';
import { formatPlanSummary, buildWeekPlan } from '@/lib/content/planner/weekly-planner';
import { listQualityQueue } from '@/lib/content/generator/text-generator';
import { prepareContentItem } from '@/lib/content/pipeline/prepare-item';
import {
  approveItem,
  formatPublishMode,
  previewNextItem,
  publishContentItem,
  publishDueToday,
  setAutoMode,
  setDryRunMode,
  setPaused,
} from '@/lib/content/publisher/channel-publisher';
import { runSiteRadarCycle, formatRecentSignals } from '@/lib/content/site-radar/orchestrator';
import { formatPostStatsSummary, formatSinglePostStat } from '@/lib/content/analytics/post-stats';
import { prisma } from '@/lib/db';

async function reply(ctx: BotContext, text: string) {
  return botReply(ctx, text, { replyMarkup: contentMainMenuKeyboard() });
}

export async function handleContentMenu(ctx: BotContext): Promise<void> {
  await botReply(ctx, '<b>📝 Контент (SMM)</b>\n\nУправление планом, радаром и публикацией:', {
    replyMarkup: contentMainMenuKeyboard(),
  });
}

export async function handleContentCallback(ctx: BotContext, action: string): Promise<void> {
  switch (action) {
    case 'menu':
      await handleContentMenu(ctx);
      break;
    case 'plan':
      await reply(ctx, await formatPlanSummary());
      break;
    case 'mode':
      await reply(ctx, await formatPublishMode());
      break;
    case 'quality':
      await reply(ctx, `<b>Quality queue</b>\n\n${await listQualityQueue()}`);
      break;
    case 'radar':
      await reply(ctx, `<b>Site Radar</b>\n\n${await formatRecentSignals(8)}`);
      break;
    case 'post_stats':
      await reply(ctx, await formatPostStatsSummary());
      break;
    default:
      await handleContentMenu(ctx);
  }
}

export async function handleContentCommand(ctx: BotContext, cmd: string, args: string[]): Promise<boolean> {
  const arg0 = args[0];

  switch (cmd) {
    case '/plan':
      await reply(ctx, await formatPlanSummary());
      return true;
    case '/plan_now': {
      const r = await buildWeekPlan();
      await reply(ctx, `<b>План создан</b>\n\n${r.items.join('\n')}\n\n${await formatPlanSummary(r.planId)}`);
      return true;
    }
    case '/preview':
      await reply(ctx, await previewNextItem());
      return true;
    case '/approve':
      if (!arg0) {
        await reply(ctx, 'Использование: /approve &lt;id-prefix&gt;');
        return true;
      }
      {
        const r = await approveItem(arg0);
        await reply(ctx, r.ok ? `✅ Опубликовано` : `❌ ${r.error}`);
      }
      return true;
    case '/publish_now':
      if (arg0) {
        const item = await prisma.contentItem.findFirst({ where: { id: { startsWith: arg0 } }, select: { id: true } });
        const r = await publishContentItem(item?.id ?? arg0, true);
        await reply(ctx, r.ok ? '✅ Публикация выполнена' : `❌ ${r.error}`);
      } else {
        const r = await publishDueToday(true);
        await reply(ctx, `✅ Опубликовано: ${r.published}`);
      }
      return true;
    case '/regenerate':
      if (!arg0) {
        await reply(ctx, 'Использование: /regenerate &lt;id-prefix&gt;');
        return true;
      }
      {
        const item = await prisma.contentItem.findFirst({ where: { id: { startsWith: arg0 } } });
        if (!item) {
          await reply(ctx, '❌ Пост не найден');
          return true;
        }
        const r = await prepareContentItem(item.id);
        await reply(ctx, r.ok ? `✅ ${r.status}\n${(r.text ?? '').slice(0, 500)}` : `❌ ${r.status}`);
      }
      return true;
    case '/quality_queue':
      await reply(ctx, `<b>Quality queue</b>\n\n${await listQualityQueue()}`);
      return true;
    case '/dry_run':
      await setDryRunMode(true);
      await reply(ctx, '✅ dry_run: превью админам.');
      return true;
    case '/auto':
      await setAutoMode(true);
      await reply(ctx, '✅ auto: публикация в канал (нужен CONTENT_CHANNEL_ID).');
      return true;
    case '/pause':
      await setPaused(true);
      await reply(ctx, '⏸ Публикация приостановлена.');
      return true;
    case '/resume':
      await setPaused(false);
      await reply(ctx, '▶️ Публикация возобновлена.');
      return true;
    case '/radar':
      await reply(ctx, `<b>Site Radar</b>\n\n${await formatRecentSignals(10)}`);
      return true;
    case '/radar_now': {
      const stats = await runSiteRadarCycle(false);
      await reply(
        ctx,
        `<b>Radar</b>\nстраниц ${stats.pagesSeen}, изменений ${stats.pagesChanged}, сигналов ${stats.signalsTotal}, тем ${stats.themesAdded}`
      );
      return true;
    }
    case '/radar_signals':
      await reply(ctx, await formatRecentSignals(15));
      return true;
    case '/kb_load': {
      try {
        const r = await applyKbFromFile();
        await reply(
          ctx,
          `✅ KB v${r.kbVersion}\nаудиторий: ${r.audiences}, тем +${r.themesInserted}/~${r.themesUpdated}`
        );
      } catch (e) {
        await reply(ctx, `❌ ${e instanceof Error ? e.message : 'ошибка KB'}`);
      }
      return true;
    }
    case '/kb_show': {
      const bp = await getBrandProfile();
      if (!bp) {
        await reply(ctx, 'KB не загружена. /kb_load');
        return true;
      }
      await reply(
        ctx,
        `<b>Brand KB</b>\nversion: <code>${bp.row.kbVersion}</code>\nTOV: ${bp.normalized.toneOfVoice.slice(0, 120)}…`
      );
      return true;
    }
    case '/post_stats':
      await reply(ctx, await formatPostStatsSummary());
      return true;
    case '/stat':
      if (!arg0) {
        await reply(ctx, 'Использование: /stat &lt;id-prefix&gt;');
        return true;
      }
      await reply(ctx, await formatSinglePostStat(arg0));
      return true;
    default:
      return false;
  }
}
