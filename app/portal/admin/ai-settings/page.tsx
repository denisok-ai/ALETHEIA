/**
 * Admin: LLM settings — edit system prompt, model for chatbot.
 */
import { createClient } from '@/lib/supabase/server';
import { AiSettingsForm } from './AiSettingsForm';

export default async function AdminAiSettingsPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Настройки AI</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { data: settings } = await supabase
    .from('llm_settings')
    .select('id, key, provider, model, system_prompt, temperature, max_tokens')
    .eq('key', 'chatbot')
    .maybeSingle();

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Настройки AI</h1>
      <p className="mt-1 text-text-muted">Промпты и модель для чат-бота (Сомаватар)</p>
      <AiSettingsForm initial={settings} />
    </div>
  );
}
