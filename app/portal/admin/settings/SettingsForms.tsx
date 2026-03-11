'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface SettingsKeys {
  site_url: string;
  portal_title: string;
  resend_from: string;
  resend_notify_email: string;
  contact_phone: string;
  paykeeper_server: string;
  paykeeper_login: string;
  paykeeper_password: boolean;
  paykeeper_secret: boolean;
  paykeeper_use_test: boolean;
  paykeeper_test_server: string;
  paykeeper_test_login: string;
  paykeeper_test_password: boolean;
  paykeeper_test_secret: boolean;
  resend_api_key: boolean;
  telegram_bot_token: boolean;
  cron_secret: boolean;
  nextauth_url: string;
}

export function SettingsForms() {
  const [keys, setKeys] = useState<SettingsKeys | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const [general, setGeneral] = useState({ site_url: '', portal_title: '', contact_phone: '' });
  const [email, setEmail] = useState({ resend_from: '', resend_notify_email: '' });
  const [paykeeper, setPaykeeper] = useState({
    paykeeper_server: '',
    paykeeper_login: '',
    paykeeper_password: '',
    paykeeper_secret: '',
  });
  const [paykeeperTest, setPaykeeperTest] = useState({
    use_test: false,
    paykeeper_test_server: '',
    paykeeper_test_login: '',
    paykeeper_test_password: '',
    paykeeper_test_secret: '',
  });
  const [envVars, setEnvVars] = useState({
    resend_api_key: '',
    telegram_bot_token: '',
    cron_secret: '',
    nextauth_url: '',
  });
  const [savingPaykeeper, setSavingPaykeeper] = useState(false);
  const [testingPaykeeper, setTestingPaykeeper] = useState(false);
  const [savingEnv, setSavingEnv] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [confirmUrlOpen, setConfirmUrlOpen] = useState(false);

  useEffect(() => {
    fetch('/api/portal/admin/settings')
      .then(async (r) => {
        if (!r.ok) throw new Error('Ошибка загрузки');
        return r.json();
      })
      .then((data) => {
        const k = data.keys ?? {};
        setKeys({
          site_url: k.site_url ?? '',
          portal_title: k.portal_title ?? '',
          resend_from: k.resend_from ?? '',
          resend_notify_email: k.resend_notify_email ?? '',
          contact_phone: k.contact_phone ?? '',
          paykeeper_server: typeof k.paykeeper_server === 'string' ? k.paykeeper_server : '',
          paykeeper_login: typeof k.paykeeper_login === 'string' ? k.paykeeper_login : '',
          paykeeper_password: k.paykeeper_password === true,
          paykeeper_secret: k.paykeeper_secret === true,
          paykeeper_use_test: k.paykeeper_use_test === true || k.paykeeper_use_test === '1' || k.paykeeper_use_test === 'true',
          paykeeper_test_server: typeof k.paykeeper_test_server === 'string' ? k.paykeeper_test_server : '',
          paykeeper_test_login: typeof k.paykeeper_test_login === 'string' ? k.paykeeper_test_login : '',
          paykeeper_test_password: k.paykeeper_test_password === true,
          paykeeper_test_secret: k.paykeeper_test_secret === true,
          resend_api_key: k.resend_api_key === true,
          telegram_bot_token: k.telegram_bot_token === true,
          cron_secret: k.cron_secret === true,
          nextauth_url: typeof k.nextauth_url === 'string' ? k.nextauth_url : '',
        });
        setEnvVars({
          resend_api_key: '',
          telegram_bot_token: '',
          cron_secret: '',
          nextauth_url: typeof k.nextauth_url === 'string' ? k.nextauth_url : '',
        });
        setGeneral({
          site_url: k.site_url ?? '',
          portal_title: k.portal_title ?? '',
          contact_phone: k.contact_phone ?? '',
        });
        setEmail({
          resend_from: k.resend_from ?? '',
          resend_notify_email: k.resend_notify_email ?? '',
        });
        setPaykeeper({
          paykeeper_server: typeof k.paykeeper_server === 'string' ? k.paykeeper_server : '',
          paykeeper_login: typeof k.paykeeper_login === 'string' ? k.paykeeper_login : '',
          paykeeper_password: '',
          paykeeper_secret: '',
        });
        setPaykeeperTest({
          use_test: k.paykeeper_use_test === true || k.paykeeper_use_test === '1' || k.paykeeper_use_test === 'true',
          paykeeper_test_server: typeof k.paykeeper_test_server === 'string' ? k.paykeeper_test_server : '',
          paykeeper_test_login: typeof k.paykeeper_test_login === 'string' ? k.paykeeper_test_login : '',
          paykeeper_test_password: '',
          paykeeper_test_secret: '',
        });
      })
      .catch(() => toast.error('Ошибка загрузки настроек'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!keys) return;
    setGeneral({
      site_url: keys.site_url,
      portal_title: keys.portal_title,
      contact_phone: keys.contact_phone,
    });
    setEmail({
      resend_from: keys.resend_from,
      resend_notify_email: keys.resend_notify_email,
    });
    setPaykeeper((p) => ({
      ...p,
      paykeeper_server: keys.paykeeper_server ?? '',
      paykeeper_login: keys.paykeeper_login ?? '',
    }));
    setPaykeeperTest((p) => ({
      ...p,
      use_test: keys.paykeeper_use_test ?? false,
      paykeeper_test_server: keys.paykeeper_test_server ?? '',
      paykeeper_test_login: keys.paykeeper_test_login ?? '',
    }));
    setEnvVars((p) => ({
      ...p,
      nextauth_url: keys.nextauth_url ?? '',
    }));
  }, [keys]);

  const siteUrlChanged = keys && general.site_url.trim() !== (keys.site_url ?? '').trim();

  function doSaveGeneral() {
    setSavingGeneral(true);
    fetch('/api/portal/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_url: general.site_url,
        portal_title: general.portal_title,
        contact_phone: general.contact_phone,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        setKeys((prev) => prev ? { ...prev, ...general } : null);
        toast.success('Общие настройки сохранены');
      })
      .catch(() => toast.error('Ошибка сохранения'))
      .finally(() => setSavingGeneral(false));
  }

  function saveGeneral(e: React.FormEvent) {
    e.preventDefault();
    if (siteUrlChanged) {
      setConfirmUrlOpen(true);
      return;
    }
    doSaveGeneral();
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const res = await fetch('/api/portal/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resend_from: email.resend_from,
          resend_notify_email: email.resend_notify_email,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setKeys((prev) => prev ? { ...prev, ...email } : null);
      toast.success('Настройки почты сохранены');
    } catch {
      toast.error('Ошибка сохранения');
    }
    setSavingEmail(false);
  }

  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-white p-6">
        <p className="text-sm text-text-muted">Загрузка настроек…</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-dark">Общие</h2>
        <p className="mt-1 text-sm text-text-muted">URL сайта и название портала. Изменение URL повлияет на ссылки в письмах и сертификатах.</p>
        <form onSubmit={saveGeneral} className="mt-4 space-y-4 max-w-xl">
          <div>
            <Label htmlFor="site_url">URL сайта</Label>
            <Input
              id="site_url"
              type="url"
              value={general.site_url}
              onChange={(e) => setGeneral((p) => ({ ...p, site_url: e.target.value }))}
              placeholder="https://avaterra.pro"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="portal_title">Название портала</Label>
            <Input
              id="portal_title"
              value={general.portal_title}
              onChange={(e) => setGeneral((p) => ({ ...p, portal_title: e.target.value }))}
              placeholder="AVATERRA"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="contact_phone">Контактный телефон</Label>
            <Input
              id="contact_phone"
              value={general.contact_phone}
              onChange={(e) => setGeneral((p) => ({ ...p, contact_phone: e.target.value }))}
              placeholder="+7 (999) 000-00-00"
              className="mt-1"
            />
          </div>
          <Button type="submit" disabled={savingGeneral}>
            {savingGeneral ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </form>
        <ConfirmDialog
          open={confirmUrlOpen}
          onOpenChange={setConfirmUrlOpen}
          title="Изменить URL сайта?"
          description="Изменение URL повлияет на ссылки в письмах, уведомлениях и в чат-боте. Продолжить?"
          confirmLabel="Сохранить"
          onConfirm={() => doSaveGeneral()}
        />
      </div>

      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-dark">Почта (уведомления)</h2>
        <p className="mt-1 text-sm text-text-muted">Email отправителя и получателя уведомлений. API-ключ Resend — в блоке «Переменные окружения» ниже или в .env (RESEND_API_KEY).</p>
        <form onSubmit={saveEmail} className="mt-4 space-y-4 max-w-xl">
          <div>
            <Label htmlFor="resend_from">Email отправителя</Label>
            <Input
              id="resend_from"
              type="email"
              value={email.resend_from}
              onChange={(e) => setEmail((p) => ({ ...p, resend_from: e.target.value }))}
              placeholder="notifications@yourdomain.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="resend_notify_email">Email получателя уведомлений</Label>
            <Input
              id="resend_notify_email"
              type="email"
              value={email.resend_notify_email}
              onChange={(e) => setEmail((p) => ({ ...p, resend_notify_email: e.target.value }))}
              placeholder="admin@yourdomain.com"
              className="mt-1"
            />
          </div>
          <Button type="submit" disabled={savingEmail}>
            {savingEmail ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-dark">Платежи (PayKeeper)</h2>
        <p className="mt-1 text-sm text-text-muted">
          Параметры для создания счетов и приёма уведомлений. Секретные поля хранятся в зашифрованном виде. Пустые поля пароля и секрета — не менять текущее значение.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSavingPaykeeper(true);
            try {
              const body: Record<string, string> = {
                paykeeper_server: paykeeper.paykeeper_server.trim(),
                paykeeper_login: paykeeper.paykeeper_login.trim(),
                paykeeper_use_test: paykeeperTest.use_test ? '1' : '0',
              };
              if (paykeeper.paykeeper_password.trim()) body.paykeeper_password = paykeeper.paykeeper_password;
              if (paykeeper.paykeeper_secret.trim()) body.paykeeper_secret = paykeeper.paykeeper_secret;
              if (paykeeperTest.use_test) {
                body.paykeeper_test_server = paykeeperTest.paykeeper_test_server.trim();
                body.paykeeper_test_login = paykeeperTest.paykeeper_test_login.trim();
                if (paykeeperTest.paykeeper_test_password.trim()) body.paykeeper_test_password = paykeeperTest.paykeeper_test_password;
                if (paykeeperTest.paykeeper_test_secret.trim()) body.paykeeper_test_secret = paykeeperTest.paykeeper_test_secret;
              }
              const res = await fetch('/api/portal/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (!res.ok) throw new Error(await res.text());
              setKeys((prev) =>
                prev
                  ? {
                      ...prev,
                      paykeeper_server: body.paykeeper_server,
                      paykeeper_login: body.paykeeper_login,
                      paykeeper_password: !!body.paykeeper_password || prev.paykeeper_password,
                      paykeeper_secret: !!body.paykeeper_secret || prev.paykeeper_secret,
                      paykeeper_use_test: paykeeperTest.use_test,
                      paykeeper_test_server: body.paykeeper_test_server ?? prev.paykeeper_test_server,
                      paykeeper_test_login: body.paykeeper_test_login ?? prev.paykeeper_test_login,
                      paykeeper_test_password: !!body.paykeeper_test_password || prev.paykeeper_test_password,
                      paykeeper_test_secret: !!body.paykeeper_test_secret || prev.paykeeper_test_secret,
                    }
                  : null
              );
              if (body.paykeeper_password) setPaykeeper((p) => ({ ...p, paykeeper_password: '' }));
              if (body.paykeeper_secret) setPaykeeper((p) => ({ ...p, paykeeper_secret: '' }));
              if (body.paykeeper_test_password) setPaykeeperTest((p) => ({ ...p, paykeeper_test_password: '' }));
              if (body.paykeeper_test_secret) setPaykeeperTest((p) => ({ ...p, paykeeper_test_secret: '' }));
              toast.success('Настройки PayKeeper сохранены');
            } catch {
              toast.error('Ошибка сохранения');
            }
            setSavingPaykeeper(false);
          }}
          className="mt-4 space-y-4 max-w-xl"
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="paykeeper_use_test"
              checked={paykeeperTest.use_test}
              onChange={(e) => setPaykeeperTest((p) => ({ ...p, use_test: e.target.checked }))}
              className="rounded border-border"
            />
            <Label htmlFor="paykeeper_use_test" className="font-normal cursor-pointer">
              Использовать тестовое подключение (отдельные сервер, логин, пароль и секрет для тестов)
            </Label>
          </div>
          {!paykeeperTest.use_test && (
            <>
          <div>
            <Label htmlFor="paykeeper_server">Сервер PayKeeper</Label>
            <Input
              id="paykeeper_server"
              type="text"
              value={paykeeper.paykeeper_server}
              onChange={(e) => setPaykeeper((p) => ({ ...p, paykeeper_server: e.target.value }))}
              placeholder="demo.server.paykeeper.ru"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="paykeeper_login">Логин</Label>
            <Input
              id="paykeeper_login"
              type="text"
              value={paykeeper.paykeeper_login}
              onChange={(e) => setPaykeeper((p) => ({ ...p, paykeeper_login: e.target.value }))}
              placeholder="Идентификатор пользователя API"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="paykeeper_password">Пароль</Label>
            <Input
              id="paykeeper_password"
              type="password"
              value={paykeeper.paykeeper_password}
              onChange={(e) => setPaykeeper((p) => ({ ...p, paykeeper_password: e.target.value }))}
              placeholder={keys?.paykeeper_password ? 'Оставьте пустым, чтобы не менять' : 'Пароль для доступа к API'}
              className="mt-1"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="paykeeper_secret">Секретное слово для webhook</Label>
            <Input
              id="paykeeper_secret"
              type="password"
              value={paykeeper.paykeeper_secret}
              onChange={(e) => setPaykeeper((p) => ({ ...p, paykeeper_secret: e.target.value }))}
              placeholder={keys?.paykeeper_secret ? 'Оставьте пустым, чтобы не менять' : 'informer_seed из ЛК PayKeeper'}
              className="mt-1"
              autoComplete="new-password"
            />
          </div>
          </>)}
          {paykeeperTest.use_test && (
            <>
          <div>
            <Label htmlFor="paykeeper_test_server">Тестовый сервер PayKeeper</Label>
            <Input
              id="paykeeper_test_server"
              type="text"
              value={paykeeperTest.paykeeper_test_server}
              onChange={(e) => setPaykeeperTest((p) => ({ ...p, paykeeper_test_server: e.target.value }))}
              placeholder="demo.server.paykeeper.ru"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="paykeeper_test_login">Тестовый логин</Label>
            <Input
              id="paykeeper_test_login"
              type="text"
              value={paykeeperTest.paykeeper_test_login}
              onChange={(e) => setPaykeeperTest((p) => ({ ...p, paykeeper_test_login: e.target.value }))}
              placeholder="Идентификатор пользователя API (тест)"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="paykeeper_test_password">Тестовый пароль</Label>
            <Input
              id="paykeeper_test_password"
              type="password"
              value={paykeeperTest.paykeeper_test_password}
              onChange={(e) => setPaykeeperTest((p) => ({ ...p, paykeeper_test_password: e.target.value }))}
              placeholder={keys?.paykeeper_test_password ? 'Оставьте пустым, чтобы не менять' : 'Пароль для тестового API'}
              className="mt-1"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="paykeeper_test_secret">Тестовое секретное слово для webhook</Label>
            <Input
              id="paykeeper_test_secret"
              type="password"
              value={paykeeperTest.paykeeper_test_secret}
              onChange={(e) => setPaykeeperTest((p) => ({ ...p, paykeeper_test_secret: e.target.value }))}
              placeholder={keys?.paykeeper_test_secret ? 'Оставьте пустым, чтобы не менять' : 'informer_seed для теста'}
              className="mt-1"
              autoComplete="new-password"
            />
          </div>
          </>
          )}
          <div className="rounded-lg border border-border bg-bg-soft p-3 text-sm text-text-muted space-y-2">
            <p className="font-medium text-dark">URL для уведомлений в ЛК PayKeeper</p>
            <p className="mt-1 break-all">
              {(keys?.site_url || general.site_url || '').replace(/\/$/, '') || 'https://ваш-домен'}/api/webhook/paykeeper
            </p>
            <p className="font-medium text-dark pt-1">URL успешной оплаты (результат)</p>
            <p className="break-all">
              {(keys?.site_url || general.site_url || '').replace(/\/$/, '') || 'https://ваш-домен'}/success
            </p>
            <p className="text-xs">Укажите этот адрес в настройках результата оплаты в личном кабинете PayKeeper, чтобы после оплаты покупатель переходил на страницу с инструкциями.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={savingPaykeeper}>
              {savingPaykeeper ? 'Сохранение…' : 'Сохранить'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={testingPaykeeper}
              onClick={async () => {
                setTestingPaykeeper(true);
                try {
                  const res = await fetch('/api/portal/admin/settings/test-paykeeper', { method: 'POST' });
                  const data = await res.json();
                  if (res.ok) {
                    toast.success('Подключение к PayKeeper успешно');
                  } else {
                    toast.error(data.error || 'Ошибка подключения');
                  }
                } catch {
                  toast.error('Ошибка запроса');
                } finally {
                  setTestingPaykeeper(false);
                }
              }}
            >
              {testingPaykeeper ? 'Проверка…' : 'Проверить подключение'}
            </Button>
            <a
              href="https://help.paykeeper.ru/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Документация PayKeeper
            </a>
          </div>
        </form>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-dark">Переменные окружения</h2>
        <p className="mt-1 text-sm text-text-muted">
          Значения сохраняются в БД и используются с приоритетом над <code className="rounded bg-bg-cream px-1">.env</code>. Секреты хранятся в зашифрованном виде. Пустые поля секретов — не менять текущее значение. NEXTAUTH_SECRET и DATABASE_URL задаются только в .env.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSavingEnv(true);
            try {
              const body: Record<string, string> = {
                nextauth_url: envVars.nextauth_url.trim(),
              };
              if (envVars.resend_api_key.trim()) body.resend_api_key = envVars.resend_api_key;
              if (envVars.telegram_bot_token.trim()) body.telegram_bot_token = envVars.telegram_bot_token;
              if (envVars.cron_secret.trim()) body.cron_secret = envVars.cron_secret;
              const res = await fetch('/api/portal/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (!res.ok) throw new Error(await res.text());
              setKeys((prev) =>
                prev
                  ? {
                      ...prev,
                      resend_api_key: !!body.resend_api_key || prev.resend_api_key,
                      telegram_bot_token: !!body.telegram_bot_token || prev.telegram_bot_token,
                      cron_secret: !!body.cron_secret || prev.cron_secret,
                      nextauth_url: body.nextauth_url ?? prev.nextauth_url,
                    }
                  : null
              );
              if (body.resend_api_key) setEnvVars((p) => ({ ...p, resend_api_key: '' }));
              if (body.telegram_bot_token) setEnvVars((p) => ({ ...p, telegram_bot_token: '' }));
              if (body.cron_secret) setEnvVars((p) => ({ ...p, cron_secret: '' }));
              toast.success('Переменные окружения сохранены');
            } catch {
              toast.error('Ошибка сохранения');
            }
            setSavingEnv(false);
          }}
          className="mt-4 space-y-4 max-w-xl"
        >
          <div>
            <Label htmlFor="env_resend_api_key">Resend API ключ (почта)</Label>
            <Input
              id="env_resend_api_key"
              type="password"
              value={envVars.resend_api_key}
              onChange={(e) => setEnvVars((p) => ({ ...p, resend_api_key: e.target.value }))}
              placeholder={keys?.resend_api_key ? 'Оставьте пустым, чтобы не менять' : 're_xxx'}
              className="mt-1"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="env_telegram_bot_token">Telegram Bot Token</Label>
            <Input
              id="env_telegram_bot_token"
              type="password"
              value={envVars.telegram_bot_token}
              onChange={(e) => setEnvVars((p) => ({ ...p, telegram_bot_token: e.target.value }))}
              placeholder={keys?.telegram_bot_token ? 'Оставьте пустым, чтобы не менять' : '123456:ABC...'}
              className="mt-1"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="env_cron_secret">Cron secret (для запланированных рассылок)</Label>
            <Input
              id="env_cron_secret"
              type="password"
              value={envVars.cron_secret}
              onChange={(e) => setEnvVars((p) => ({ ...p, cron_secret: e.target.value }))}
              placeholder={keys?.cron_secret ? 'Оставьте пустым, чтобы не менять' : 'Authorization: Bearer ...'}
              className="mt-1"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="env_nextauth_url">NEXTAUTH_URL (URL для NextAuth)</Label>
            <Input
              id="env_nextauth_url"
              type="url"
              value={envVars.nextauth_url}
              onChange={(e) => setEnvVars((p) => ({ ...p, nextauth_url: e.target.value }))}
              placeholder="http://localhost:3000 или https://yourdomain.com"
              className="mt-1"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={savingEnv}>
              {savingEnv ? 'Сохранение…' : 'Сохранить'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={testingEmail || !keys?.resend_api_key}
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
            <Button
              type="button"
              variant="secondary"
              disabled={testingTelegram || !keys?.telegram_bot_token}
              onClick={async () => {
                setTestingTelegram(true);
                try {
                  const res = await fetch('/api/portal/admin/settings/test-telegram', { method: 'POST' });
                  const data = await res.json();
                  if (res.ok) {
                    toast.success(data.botUsername ? `Telegram: @${data.botUsername}` : 'Telegram подключён');
                  } else {
                    toast.error(data.error || 'Ошибка проверки');
                  }
                } catch {
                  toast.error('Ошибка запроса');
                } finally {
                  setTestingTelegram(false);
                }
              }}
            >
              {testingTelegram ? 'Проверка…' : 'Проверить Telegram'}
            </Button>
          </div>
          <p className="text-xs text-text-muted">
            Тестовое письмо уходит на адрес из блока «Почта». Telegram: проверка токена через getMe.
          </p>
        </form>
      </div>
    </div>
  );
}
