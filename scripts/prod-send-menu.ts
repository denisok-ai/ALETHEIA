import { sendTelegramMessageWithResult } from "../lib/telegram";
import { handleUserMainMenu } from "../lib/telegram-bot/support-handlers";

const chatId = Number(process.argv[2] || 337952743);

async function main() {
  const ping = await sendTelegramMessageWithResult(chatId, "AVATERRA: тест исходящего. Отправляю меню...");
  console.log("ping", ping);
  await handleUserMainMenu({ chatId, displayName: "User", isAdmin: false, text: "/start", command: "/start" });
  console.log("menu sent to", chatId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
