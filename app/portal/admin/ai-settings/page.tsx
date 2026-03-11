/**
 * Admin: AI settings — one scroll (main), merged LLM + chatbot block, prompt templates, knowledge base, test chat.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { LlmAndChatbotBlock } from './LlmAndChatbotBlock';
import { PromptTemplatesBlock } from './PromptTemplatesBlock';
import { KnowledgeBaseBlock } from './KnowledgeBaseBlock';
import { AiTestChat } from './AiTestChat';

export default async function AdminAiSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Настройки AI' }]} title="Настройки AI" description="Доступ запрещён." />
      </div>
    );
  }

  const [chatbotSettings, courseTutorSettings] = await Promise.all([
    prisma.llmSetting.findUnique({
      where: { key: 'chatbot' },
      include: { apiKey: { select: { id: true, name: true, provider: true } } },
    }),
    prisma.llmSetting.findUnique({
      where: { key: 'course-tutor' },
      include: { apiKey: { select: { id: true, name: true, provider: true } } },
    }),
  ]);

  const chatbotInitial = chatbotSettings
    ? {
        provider: chatbotSettings.provider,
        model: chatbotSettings.model,
        system_prompt: chatbotSettings.systemPrompt,
        temperature: chatbotSettings.temperature ?? 0.7,
        max_tokens: chatbotSettings.maxTokens ?? 2000,
        api_key_set: Boolean(chatbotSettings.apiKeyEncrypted) || Boolean(chatbotSettings.apiKeyId),
        api_key_id: chatbotSettings.apiKeyId ?? null,
        api_key_ref: chatbotSettings.apiKey
          ? { id: chatbotSettings.apiKey.id, name: chatbotSettings.apiKey.name, provider: chatbotSettings.apiKey.provider }
          : null,
      }
    : null;

  const courseTutorInitial = courseTutorSettings
    ? {
        provider: courseTutorSettings.provider,
        model: courseTutorSettings.model,
        temperature: courseTutorSettings.temperature ?? 0.5,
        max_tokens: courseTutorSettings.maxTokens ?? 1500,
        api_key_set: Boolean(courseTutorSettings.apiKeyEncrypted) || Boolean(courseTutorSettings.apiKeyId),
        api_key_id: courseTutorSettings.apiKeyId ?? null,
        api_key_ref: courseTutorSettings.apiKey
          ? { id: courseTutorSettings.apiKey.id, name: courseTutorSettings.apiKey.name, provider: courseTutorSettings.apiKey.provider }
          : null,
      }
    : null;

  return (
    <div className="space-y-8 overflow-visible">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Настройки AI' },
        ]}
        title="Настройки AI"
        description="Подключение LLM, шаблоны промптов, база знаний, тест чат-бота"
      />

      <div className="space-y-8">
        <LlmAndChatbotBlock chatbotInitial={chatbotInitial} tutorInitial={courseTutorInitial} />

        <PromptTemplatesBlock />

        <KnowledgeBaseBlock />

        <Card title="Тест чат-бота" description="Проверка ответов с текущими настройками (активный шаблон промпта + база знаний).">
          <AiTestChat />
        </Card>

        <Card title="Лог запросов к AI" description="Логирование запросов планируется в следующих версиях.">
          <p className="text-sm text-text-muted">—</p>
        </Card>
      </div>
    </div>
  );
}
