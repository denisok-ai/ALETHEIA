import { sendTelegramMessageWithResult } from "../lib/telegram";
import { handleUserMainMenu } from "../lib/telegram-bot/support-handlers";
import { getTelegramWebhookInfo } from "../lib/telegram-webhook-setup";
import { getEnvOverrides, getSystemSettings } from "../lib/settings";
import { telegramApiFetch } from "../lib/telegram-fetch";

const chatId = Number(process.argv[2] || 337952743);

async function setWebhookDropPending() {
  const o = await getEnvOverrides();
  const token = o.telegram_bot_token;
  if (!token) throw new Error("no token");
  const settings = await getSystemSettings();
  const siteUrl = (settings.site_url || "").replace(/\/$/, "");
  const url = `${siteUrl}/api/portal/telegram/webhook`;
  const secret = o.telegram_webhook_secret?.trim();
  const body: Record<string, unknown> = { url, drop_pending_updates: false, max_connections: 5 };
  if (secret) body.secret_token = secret;
  const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log("setWebhook", JSON.stringify(data));
  const info = await getTelegramWebhookInfo();
  console.log("pending", info.pending_update_count, "last_error", info.last_error_message || "none");
}

async function main() {
  await setWebhookDropPending();
  const ping = await sendTelegramMessageWithResult(chatId, "AVATERRA: webhook reset. Sending menu...");
  console.log("ping", ping);
  await handleUserMainMenu({ chatId, displayName: "User", isAdmin: false, text: "/start", command: "/start" });
  console.log("menu sent to", chatId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
