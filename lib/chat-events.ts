/** Имя события для открытия виджета чата ([`ChatBot`]) с кнопок шапки и контактов. */
export const AVATERRA_OPEN_CHAT_EVENT = 'avaterra:open-chat';

export function dispatchOpenAvaterraChat(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AVATERRA_OPEN_CHAT_EVENT));
}
