'use client';

/**
 * Настройки исходящей почты (Resend/SMTP): общий блок для «Настройки» и центра «Почта → Доставка».
 */
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Label } from '@/components/ui/label';

type OutboundMailPreset = {
  smtpHost: string;
  smtpPort: string;
  senderExample: string;
  notifyExample: string;
};

interface OutboundKeys {
  resend_from: string;
  resend_notify_email: string;
  resend_api_key: boolean;
  smtp_password: boolean;
  email_transport?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_secure?: string;
}

export function OutboundMailSettingsBlock({
  title = 'Доставка писем',
  description,
  onMailTransportReadyChange,
}: {
  title?: string;
  description?: React.ReactNode;
  /** Для шаблонов оплат и тестов в «Настройках»: есть ли рабочий транспорт. */
  onMailTransportReadyChange?: (ready: boolean) => void;
}) {
  const defaultPreset = (): OutboundMailPreset => ({
    smtpHost: 'mail.avaterra.pro',
    smtpPort: '587',
    senderExample: 'notifications@avaterra.pro',
    notifyExample: 'admin@avaterra.pro',
  });
  const [mailPreset, setMailPreset] = useState<OutboundMailPreset>(defaultPreset);

  const [keys, setKeys] = useState<OutboundKeys | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState({ resend_from: '', resend_notify_email: '' });
  const [envVars, setEnvVars] = useState({
    email_transport: '',
    resend_api_key: '',
    smtp_host: '',
    smtp_port: defaultPreset().smtpPort,
    smtp_user: '',
    smtp_password: '',
    smtp_secure: '',
  });
  const [savingOutboundMail, setSavingOutboundMail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  const mailTransportReady = useMemo(() => {
    if (!keys) return false;
    const transport = (envVars.email_transport || keys.email_transport || '').trim().toLowerCase();
    const effectiveTransport =
      transport === '' || transport === 'auto' ? 'auto' : transport === 'resend' ? 'resend' : transport === 'smtp' ? 'smtp' : 'auto';
    const hasResendKey = keys.resend_api_key || envVars.resend_api_key.trim().length > 0;
    const smtpPwdOk = keys.smtp_password || envVars.smtp_password.trim().length > 0;
    const host = (envVars.smtp_host || keys.smtp_host || '').trim();
    const user = (envVars.smtp_user || keys.smtp_user || '').trim();
    const smtpComplete = !!(host && user && smtpPwdOk);

    if (effectiveTransport === 'resend') return hasResendKey;
    if (effectiveTransport === 'smtp') return smtpComplete;
    return hasResendKey || smtpComplete;
  }, [
    keys,
    envVars.email_transport,
    envVars.resend_api_key,
    envVars.smtp_host,
    envVars.smtp_user,
    envVars.smtp_password,
  ]);

  useEffect(() => {
    onMailTransportReadyChange?.(mailTransportReady);
  }, [mailTransportReady, onMailTransportReadyChange]);

  useEffect(() => {
    fetch('/api/portal/admin/settings')
      .then(async (r) => {
        if (!r.ok) throw new Error('Ошибка загрузки');
        return r.json();
      })
      .then((data) => {
        const preset = data.outboundMailPreset as Partial<OutboundMailPreset> | undefined;
        const p = {
          ...defaultPreset(),
          ...(preset?.smtpHost ? { smtpHost: preset.smtpHost } : {}),
          ...(preset?.smtpPort ? { smtpPort: String(preset.smtpPort) } : {}),
          ...(preset?.senderExample ? { senderExample: preset.senderExample } : {}),
          ...(preset?.notifyExample ? { notifyExample: preset.notifyExample } : {}),
        };
        setMailPreset(p);

        const k = data.keys ?? {};
        const fallbackPort = p.smtpPort;
        setKeys({
          resend_from: k.resend_from ?? '',
          resend_notify_email: k.resend_notify_email ?? '',
          resend_api_key: k.resend_api_key === true,
          smtp_password: k.smtp_password === true,
          email_transport: typeof k.email_transport === 'string' ? k.email_transport : '',
          smtp_host: typeof k.smtp_host === 'string' ? k.smtp_host : '',
          smtp_port: typeof k.smtp_port === 'string' && k.smtp_port ? k.smtp_port : fallbackPort,
          smtp_user: typeof k.smtp_user === 'string' ? k.smtp_user : '',
          smtp_secure: typeof k.smtp_secure === 'string' ? k.smtp_secure : '',
        });
        setEmail({
          resend_from: k.resend_from ?? '',
          resend_notify_email: k.resend_notify_email ?? '',
        });
        setEnvVars({
          email_transport: typeof k.email_transport === 'string' ? k.email_transport : '',
          resend_api_key: '',
          smtp_host: typeof k.smtp_host === 'string' ? k.smtp_host : '',
          smtp_port: typeof k.smtp_port === 'string' && k.smtp_port ? k.smtp_port : fallbackPort,
          smtp_user: typeof k.smtp_user === 'string' ? k.smtp_user : '',
          smtp_password: '',
          smtp_secure: typeof k.smtp_secure === 'string' ? k.smtp_secure : '',
        });
      })
      .catch(() => toast.error('Ошибка загрузки настроек почты'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!keys) return;
    setEmail({
      resend_from: keys.resend_from,
      resend_notify_email: keys.resend_notify_email,
    });
    setEnvVars((prev) => ({
      ...prev,
      email_transport: keys.email_transport ?? '',
      smtp_host: keys.smtp_host ?? '',
      smtp_port: keys.smtp_port && keys.smtp_port.trim() ? keys.smtp_port : mailPreset.smtpPort,
      smtp_user: keys.smtp_user ?? '',
      smtp_secure: keys.smtp_secure ?? '',
    }));
  }, [keys, mailPreset.smtpPort]);

  async function saveOutboundMail(e: React.FormEvent) {
    e.preventDefault();
    setSavingOutboundMail(true);
    try {
      const transportRaw = (envVars.email_transport || '').trim().toLowerCase();
      let email_transport = '';
      if (transportRaw === 'resend') email_transport = 'resend';
      else if (transportRaw === 'smtp') email_transport = 'smtp';

      const body: Record<string, string> = {
        resend_from: email.resend_from.trim(),
        resend_notify_email: email.resend_notify_email.trim(),
        email_transport,
        smtp_host: envVars.smtp_host.trim(),
        smtp_port: envVars.smtp_port.trim() || mailPreset.smtpPort,
        smtp_user: envVars.smtp_user.trim(),
        smtp_secure: envVars.smtp_secure.trim(),
      };
      if (envVars.resend_api_key.trim()) body.resend_api_key = envVars.resend_api_key.trim();
      if (envVars.smtp_password.trim()) body.smtp_password = envVars.smtp_password.trim();

      const res = await fetch('/api/portal/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const errText = await res.text();
      if (!res.ok) throw new Error(errText || res.statusText);

      setKeys((prev) =>
        prev
          ? {
              ...prev,
              ...email,
              email_transport,
              smtp_host: body.smtp_host,
              smtp_port: body.smtp_port,
              smtp_user: body.smtp_user,
              smtp_secure: body.smtp_secure,
              resend_api_key: !!body.resend_api_key || prev.resend_api_key,
              smtp_password: !!body.smtp_password || prev.smtp_password,
            }
          : null
      );
      if (body.resend_api_key) setEnvVars((p) => ({ ...p, resend_api_key: '' }));
      if (body.smtp_password) setEnvVars((p) => ({ ...p, smtp_password: '' }));
      toast.success('Доставка писем сохранена в БД');
    } catch {
      toast.error('Ошибка сохранения');
    }
    setSavingOutboundMail(false);
  }

  if (loading || !keys) {
    return (
      <div className="portal-card p-6">
        <div className="flex items-center gap-3 py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal-accent)] border-t-transparent" aria-hidden />
          <p className="text-sm text-[var(--portal-text-muted)]">Загрузка настроек почты…</p>
        </div>
      </div>
    );
  }

  const defaultDescription = (
    <>
      Транспорт, ключи и SMTP сохраняются в БД (приоритет над .env). Для <strong>встроенного почтового сервера</strong>{' '}
      (Mailcow, обычно хост вида <code className="rounded bg-[#F1EFEA] px-1">{mailPreset.smtpHost}</code>, порт{' '}
      {mailPreset.smtpPort}, STARTTLS) выберите «Только SMTP», если не хотите использовать Resend. В режиме «Авто» при
      наличии <strong>действующего</strong> ключа Resend письма уйдут через Resend. Отправитель и тестовые письма — ниже;
      для SMTP адрес отправителя должен быть тем же ящиком, что логин SMTP (см. docs/Env-Config.md).
    </>
  );

  return (
    <div className="portal-card p-6">
      <h2 className="text-base font-semibold text-[var(--portal-text)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)] max-w-3xl">{description ?? defaultDescription}</p>
      <form onSubmit={saveOutboundMail} className="mt-4 space-y-4 max-w-3xl">
        <div>
          <Label htmlFor="email_transport_select_outbound">Транспорт исходящей почты</Label>
          <select
            id="email_transport_select_outbound"
            value={(envVars.email_transport || '').trim() === '' ? 'auto' : envVars.email_transport.trim().toLowerCase()}
            onChange={(e) => {
              const v = e.target.value;
              setEnvVars((p) => ({ ...p, email_transport: v === 'auto' ? '' : v }));
            }}
            className="mt-1 flex h-10 w-full max-w-md rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:border-[var(--portal-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--portal-accent)]"
          >
            <option value="auto">Авто</option>
            <option value="resend">Только Resend</option>
            <option value="smtp">Только SMTP</option>
          </select>
        </div>
        <div>
          <Label htmlFor="resend_from_outbound">Email отправителя</Label>
          <Input
            id="resend_from_outbound"
            type="email"
            value={email.resend_from}
            onChange={(e) => setEmail((p) => ({ ...p, resend_from: e.target.value }))}
            placeholder={mailPreset.senderExample}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="resend_notify_email_outbound">Email получателя уведомлений (тестовые письма)</Label>
          <Input
            id="resend_notify_email_outbound"
            type="email"
            value={email.resend_notify_email}
            onChange={(e) => setEmail((p) => ({ ...p, resend_notify_email: e.target.value }))}
            placeholder={mailPreset.notifyExample}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="env_resend_api_key_outbound">Resend API ключ</Label>
          <PasswordInput
            id="env_resend_api_key_outbound"
            ariaLabelShow="Показать ключ"
            ariaLabelHide="Скрыть ключ"
            value={envVars.resend_api_key}
            onChange={(e) => setEnvVars((p) => ({ ...p, resend_api_key: e.target.value }))}
            placeholder={keys?.resend_api_key ? 'Оставьте пустым, чтобы не менять' : 're_xxx'}
            className="mt-1"
            autoComplete="new-password"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="smtp_host_outbound">SMTP — хост</Label>
            <Input
              id="smtp_host_outbound"
              value={envVars.smtp_host}
              onChange={(e) => setEnvVars((p) => ({ ...p, smtp_host: e.target.value }))}
              placeholder={mailPreset.smtpHost}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="smtp_port_outbound">SMTP — порт</Label>
            <Input
              id="smtp_port_outbound"
              type="number"
              min={1}
              max={65535}
              value={envVars.smtp_port}
              onChange={(e) => setEnvVars((p) => ({ ...p, smtp_port: e.target.value }))}
              placeholder={`${mailPreset.smtpPort} (или 465 для SSL)`}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="smtp_secure_outbound">SMTP — TLS (secure)</Label>
            <Input
              id="smtp_secure_outbound"
              value={envVars.smtp_secure}
              onChange={(e) => setEnvVars((p) => ({ ...p, smtp_secure: e.target.value }))}
              placeholder="пусто = авто по порту; true/false или 1/0"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
              На своём сервере чаще порт {mailPreset.smtpPort} и STARTTLS — поле можно оставить пустым. Для 465 обычно
              SSL (secure=true).
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="smtp_user_outbound">SMTP — пользователь</Label>
            <Input
              id="smtp_user_outbound"
              value={envVars.smtp_user}
              onChange={(e) => setEnvVars((p) => ({ ...p, smtp_user: e.target.value }))}
              placeholder={`пример: ${mailPreset.senderExample}`}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="smtp_password_outbound">SMTP — пароль приложения</Label>
            <PasswordInput
              id="smtp_password_outbound"
              ariaLabelShow="Показать пароль"
              ariaLabelHide="Скрыть пароль"
              value={envVars.smtp_password}
              onChange={(e) => setEnvVars((p) => ({ ...p, smtp_password: e.target.value }))}
              placeholder={
                keys?.smtp_password === true
                  ? 'Оставьте пустым — сохранённый пароль не показывается'
                  : 'Вставьте пароль приложения почтового сервиса'
              }
              className="mt-1"
              autoComplete="new-password"
            />
            <div className="mt-2 space-y-1 rounded-lg border border-[#E8E4DE] bg-[#FAF9F7] px-3 py-2 text-xs text-[var(--portal-text-muted)] leading-relaxed">
              <p>
                <strong>Почему поле пустое после сохранения:</strong> секрет хранится только на сервере в зашифрованном виде
                и в браузер не передаётся. Если ниже указано «пароль уже сохранён», отправка использует сохранённое значение
                — вводите текст только когда нужно <strong>заменить</strong> пароль.
              </p>
              <p>
                <strong>Встроенный SMTP (Mailcow):</strong> используйте пароль того же ящика, что и в поле «пользователь»
                (как при входе в веб-почту или ящиках домена в этом портале).
              </p>
              <p>
                <strong>Внешний провайдер (Mail.ru и др.):</strong> обычно нужен{' '}
                <a
                  href="https://help.mail.ru/mail/security/protection/external/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--portal-accent)] underline"
                >
                  пароль приложения
                </a>
                , не пароль входа в аккаунт.
              </p>
              {keys?.smtp_password === true ? (
                <p className="font-medium text-green-800">
                  ✓ Пароль приложения сохранён в базе — для теста нажмите «Отправить тестовое письмо» (поле можно не заполнять).
                </p>
              ) : (
                <p className="text-amber-900">
                  Пароль ещё не сохранён в БД — вставьте пароль приложения и нажмите «Сохранить».
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={savingOutboundMail}>
            {savingOutboundMail ? 'Сохранение…' : 'Сохранить'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={testingEmail || !mailTransportReady}
            onClick={async () => {
              setTestingEmail(true);
              try {
                const res = await fetch('/api/portal/admin/settings/test-email', { method: 'POST' });
                const data = await res.json();
                if (res.ok) {
                  toast.success(`Тестовое письмо отправлено на ${data.sentTo}`);
                } else {
                  toast.error(data.error || 'Ошибка отправки');
                }
              } catch {
                toast.error('Ошибка запроса');
              } finally {
                setTestingEmail(false);
              }
            }}
          >
            {testingEmail ? 'Отправка…' : 'Отправить тестовое письмо'}
          </Button>
        </div>
        <p className="text-xs text-[var(--portal-text-muted)]">
          Тест уходит на «Email получателя уведомлений». Убедитесь, что выбранный транспорт и ключи соответствуют режиму
          (Resend или SMTP).
        </p>
      </form>
    </div>
  );
}
