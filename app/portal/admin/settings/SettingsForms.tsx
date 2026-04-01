'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface PaymentEmailSettings {
  email_payment_course_subject: string;
  email_payment_course_body: string;
  email_payment_generic_subject: string;
  email_payment_generic_body: string;
}

interface SettingsKeys {
  site_url: string;
  portal_title: string;
  resend_from: string;
  resend_notify_email: string;
  contact_phone: string;
  company_legal_address: string;
  scorm_max_size_mb: string;
  email_payment_course_subject?: string;
  email_payment_course_body?: string;
  email_payment_generic_subject?: string;
  email_payment_generic_body?: string;
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
  telegram_webhook_secret?: boolean;
  cron_secret: boolean;
  nextauth_url: string;
  openai_api_key?: boolean;
  deepseek_api_key?: boolean;
}

export function SettingsForms() {
  const [keys, setKeys] = useState<SettingsKeys | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPaymentEmail, setSavingPaymentEmail] = useState(false);

  const [general, setGeneral] = useState({
    site_url: '',
    portal_title: '',
    contact_phone: '',
    company_legal_address: '',
    scorm_max_size_mb: '200',
  });
  const [email, setEmail] = useState({ resend_from: '', resend_notify_email: '' });
  const [paymentEmail, setPaymentEmail] = useState<PaymentEmailSettings>({
    email_payment_course_subject: '',
    email_payment_course_body: '',
    email_payment_generic_subject: '',
    email_payment_generic_body: '',
  });
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
    telegram_webhook_secret: '',
    cron_secret: '',
    nextauth_url: '',
    openai_api_key: '',
    deepseek_api_key: '',
  });
  const [savingPaykeeper, setSavingPaykeeper] = useState(false);
  const [testingPaykeeper, setTestingPaykeeper] = useState(false);
  const [savingEnv, setSavingEnv] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [confirmUrlOpen, setConfirmUrlOpen] = useState(false);
  const [paymentPreviewLoading, setPaymentPreviewLoading] = useState(false);
  const [paymentTestSending, setPaymentTestSending] = useState(false);
  const [paymentPreview, setPaymentPreview] = useState<{ subject: string; html: string; kind: string } | null>(null);
  const [confirmImportEnvOpen, setConfirmImportEnvOpen] = useState(false);
  const [importingEnv, setImportingEnv] = useState(false);

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
          company_legal_address: typeof k.company_legal_address === 'string' ? k.company_legal_address : '',
          scorm_max_size_mb: k.scorm_max_size_mb ?? '200',
          email_payment_course_subject: typeof k.email_payment_course_subject === 'string' ? k.email_payment_course_subject : '',
          email_payment_course_body: typeof k.email_payment_course_body === 'string' ? k.email_payment_course_body : '',
          email_payment_generic_subject: typeof k.email_payment_generic_subject === 'string' ? k.email_payment_generic_subject : '',
          email_payment_generic_body: typeof k.email_payment_generic_body === 'string' ? k.email_payment_generic_body : '',
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
          telegram_webhook_secret: k.telegram_webhook_secret === true,
          cron_secret: k.cron_secret === true,
          nextauth_url: typeof k.nextauth_url === 'string' ? k.nextauth_url : '',
          openai_api_key: k.openai_api_key === true,
          deepseek_api_key: k.deepseek_api_key === true,
        });
        setEnvVars({
          resend_api_key: '',
          telegram_bot_token: '',
          telegram_webhook_secret: '',
          cron_secret: '',
          nextauth_url: typeof k.nextauth_url === 'string' ? k.nextauth_url : '',
          openai_api_key: '',
          deepseek_api_key: '',
        });
        setGeneral({
          site_url: k.site_url ?? '',
          portal_title: k.portal_title ?? '',
          contact_phone: k.contact_phone ?? '',
          company_legal_address: typeof k.company_legal_address === 'string' ? k.company_legal_address : '',
          scorm_max_size_mb: k.scorm_max_size_mb ?? '200',
        });
        setEmail({
          resend_from: k.resend_from ?? '',
          resend_notify_email: k.resend_notify_email ?? '',
        });
        const pe = data.settings?.payment_email ?? {};
        setPaymentEmail({
          email_payment_course_subject: pe.email_payment_course_subject ?? '',
          email_payment_course_body: pe.email_payment_course_body ?? '',
          email_payment_generic_subject: pe.email_payment_generic_subject ?? '',
          email_payment_generic_body: pe.email_payment_generic_body ?? '',
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
      company_legal_address: keys.company_legal_address ?? '',
      scorm_max_size_mb: keys.scorm_max_size_mb ?? '200',
    });
    setEmail({
      resend_from: keys.resend_from,
      resend_notify_email: keys.resend_notify_email,
    });
    setPaymentEmail((p) => ({
      ...p,
      email_payment_course_subject: keys.email_payment_course_subject ?? '',
      email_payment_course_body: keys.email_payment_course_body ?? '',
      email_payment_generic_subject: keys.email_payment_generic_subject ?? '',
      email_payment_generic_body: keys.email_payment_generic_body ?? '',
    }));
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
        company_legal_address: general.company_legal_address,
        scorm_max_size_mb: general.scorm_max_size_mb,
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

  async function savePaymentEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingPaymentEmail(true);
    try {
      const res = await fetch('/api/portal/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_payment_course_subject: paymentEmail.email_payment_course_subject,
          email_payment_course_body: paymentEmail.email_payment_course_body,
          email_payment_generic_subject: paymentEmail.email_payment_generic_subject,
          email_payment_generic_body: paymentEmail.email_payment_generic_body,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setKeys((prev) => (prev ? { ...prev, ...paymentEmail } : null));
      toast.success('Шаблоны писем об оплате сохранены');
    } catch {
      toast.error('Ошибка сохранения');
    }
    setSavingPaymentEmail(false);
  }

  if (loading) {
    return (
      <div className="mt-4 portal-card p-10 flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal-accent)] border-t-transparent" aria-hidden />
        <p className="text-sm text-[var(--portal-text-muted)]">Загрузка настроек…</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="portal-card p-6">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Общие</h2>
        <p className="mt-1 text-sm text-[var(--portal-text-muted)]">URL сайта и название портала. Изменение URL повлияет на ссылки в письмах и сертификатах.</p>
        <form onSubmit={saveGeneral} className="mt-4 max-w-3xl space-y-4">
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
          <div>
            <Label htmlFor="company_legal_address">Юридический / почтовый адрес компании</Label>
            <textarea
              id="company_legal_address"
              value={general.company_legal_address}
              onChange={(e) => setGeneral((p) => ({ ...p, company_legal_address: e.target.value }))}
              placeholder="Полное наименование и адрес для писем и документов"
              rows={3}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)]"
            />
          </div>
          <div>
            <Label htmlFor="scorm_max_size_mb">Макс. размер SCORM-пакета (МБ)</Label>
            <Input
              id="scorm_max_size_mb"
              type="number"
              min={1}
              max={1000}
              value={general.scorm_max_size_mb}
              onChange={(e) => setGeneral((p) => ({ ...p, scorm_max_size_mb: e.target.value }))}
              placeholder="200"
              className="mt-1 w-32"
            />
            <p className="mt-1 text-xs text-[var(--portal-text-muted)]">Ограничение размера ZIP при загрузке курса. По умолчанию 200 МБ.</p>
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

      <div className="portal-card p-6">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Почта (уведомления)</h2>
        <p className="mt-1 text-sm text-[var(--portal-text-muted)]">Email отправителя и получателя уведомлений. API-ключ Resend — в блоке «Переменные окружения» ниже или в .env (RESEND_API_KEY).</p>
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

      <div className="portal-card p-6">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Шаблоны писем об оплате</h2>
        <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
          Тема и тело писем после оплаты. Если пусто — используется текст по умолчанию. Плейсхолдеры: {'{{orderid}}'}, {'{{courseTitle}}'}, {'{{userName}}'}, {'{{orderAmount}}'}, {'{{loginUrl}}'}, {'{{successUrl}}'}, {'{{portalUrl}}'}, {'{{ofertaUrl}}'} (к ссылке можно добавить якорь: #oplata, #dostup, #vozvrat), {'{{supportEmail}}'}, {'{{company_address}}'}, {'{{portal_title}}'}.
        </p>
        <form onSubmit={savePaymentEmail} className="mt-4 space-y-4 max-w-2xl">
          <div>
            <Label>Письмо при оплате курса — тема</Label>
            <Input
              value={paymentEmail.email_payment_course_subject}
              onChange={(e) => setPaymentEmail((p) => ({ ...p, email_payment_course_subject: e.target.value }))}
              placeholder="Оплата получена — доступ к курсу открыт"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Письмо при оплате курса — тело (HTML)</Label>
            <textarea
              value={paymentEmail.email_payment_course_body}
              onChange={(e) => setPaymentEmail((p) => ({ ...p, email_payment_course_body: e.target.value }))}
              placeholder="<p>Здравствуйте!</p><p>Оплата по заказу {{orderid}} получена...</p>"
              rows={6}
              className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:border-[var(--portal-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--portal-accent)]"
            />
          </div>
          <div>
            <Label>Письмо при оплате без курса (консультация и т.п.) — тема</Label>
            <Input
              value={paymentEmail.email_payment_generic_subject}
              onChange={(e) => setPaymentEmail((p) => ({ ...p, email_payment_generic_subject: e.target.value }))}
              placeholder="Оплата получена"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Письмо при оплате без курса — тело (HTML)</Label>
            <textarea
              value={paymentEmail.email_payment_generic_body}
              onChange={(e) => setPaymentEmail((p) => ({ ...p, email_payment_generic_body: e.target.value }))}
              placeholder="<p>Здравствуйте!</p><p>Оплата по заказу {{orderid}} получена...</p>"
              rows={4}
              className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:border-[var(--portal-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--portal-accent)]"
            />
          </div>
          <Button type="submit" disabled={savingPaymentEmail}>
            {savingPaymentEmail ? 'Сохранение…' : 'Сохранить шаблоны'}
          </Button>
        </form>
        <div className="mt-6 space-y-3 border-t border-[#E2E8F0] pt-6">
          <p className="text-sm font-medium text-[var(--portal-text)]">Превью с подстановкой тестовых данных</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={paymentPreviewLoading}
              onClick={async () => {
                setPaymentPreviewLoading(true);
                try {
                  const res = await fetch('/api/portal/admin/settings/payment-email-test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind: 'course', send: false }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    toast.error(typeof data.error === 'string' ? data.error : 'Ошибка превью');
                    return;
                  }
                  setPaymentPreview({
                    subject: data.subject,
                    html: data.html,
                    kind: data.kind ?? 'course',
                  });
                } catch {
                  toast.error('Ошибка запроса');
                } finally {
                  setPaymentPreviewLoading(false);
                }
              }}
            >
              {paymentPreviewLoading ? '…' : 'Превью: оплата курса'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={paymentPreviewLoading}
              onClick={async () => {
                setPaymentPreviewLoading(true);
                try {
                  const res = await fetch('/api/portal/admin/settings/payment-email-test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind: 'generic', send: false }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    toast.error(typeof data.error === 'string' ? data.error : 'Ошибка превью');
                    return;
                  }
                  setPaymentPreview({
                    subject: data.subject,
                    html: data.html,
                    kind: data.kind ?? 'generic',
                  });
                } catch {
                  toast.error('Ошибка запроса');
                } finally {
                  setPaymentPreviewLoading(false);
                }
              }}
            >
              {paymentPreviewLoading ? '…' : 'Превью: без курса'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={paymentTestSending || !keys?.resend_api_key}
              onClick={async () => {
                setPaymentTestSending(true);
                try {
                  const res = await fetch('/api/portal/admin/settings/payment-email-test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind: 'course', send: true }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    toast.error(typeof data.error === 'string' ? data.error : 'Ошибка отправки');
                    return;
                  }
                  toast.success(`Тест «курс» отправлен на ${data.sentTo}`);
                } catch {
                  toast.error('Ошибка запроса');
                } finally {
                  setPaymentTestSending(false);
                }
              }}
            >
              {paymentTestSending ? '…' : 'Тест на email: курс'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={paymentTestSending || !keys?.resend_api_key}
              onClick={async () => {
                setPaymentTestSending(true);
                try {
                  const res = await fetch('/api/portal/admin/settings/payment-email-test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind: 'generic', send: true }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    toast.error(typeof data.error === 'string' ? data.error : 'Ошибка отправки');
                    return;
                  }
                  toast.success(`Тест «без курса» отправлен на ${data.sentTo}`);
                } catch {
                  toast.error('Ошибка запроса');
                } finally {
                  setPaymentTestSending(false);
                }
              }}
            >
              {paymentTestSending ? '…' : 'Тест на email: без курса'}
            </Button>
          </div>
          <p className="text-xs text-[var(--portal-text-muted)]">
            Тест уходит на «Email получателя уведомлений» из блока «Почта». Нужен сохранённый Resend API-ключ.
          </p>
          {paymentPreview && (
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="text-xs text-[var(--portal-text-muted)]">Тип: {paymentPreview.kind}</p>
              <p className="mt-1 text-sm font-medium text-[var(--portal-text)]">Тема: {paymentPreview.subject}</p>
              <iframe
                title="Превью HTML письма"
                className="mt-2 w-full min-h-[200px] rounded border border-[#E2E8F0] bg-white"
                srcDoc={paymentPreview.html}
                sandbox=""
              />
            </div>
          )}
        </div>
      </div>

      <div className="portal-card p-6">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Платежи (PayKeeper)</h2>
        <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
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
              className="rounded border-[#E2E8F0]"
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
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[var(--portal-text-muted)] space-y-2">
            <p className="font-medium text-[var(--portal-text)]">URL для уведомлений в ЛК PayKeeper</p>
            <p className="mt-1 break-all">
              {(keys?.site_url || general.site_url || '').replace(/\/$/, '') || 'https://ваш-домен'}/api/webhook/paykeeper
            </p>
            <p className="font-medium text-[var(--portal-text)] pt-1">URL успешной оплаты (результат)</p>
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
              className="text-sm text-[var(--portal-accent)] hover:underline"
            >
              Документация PayKeeper
            </a>
          </div>
        </form>
      </div>

      <div className="mt-6 portal-card p-6">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Переменные окружения</h2>
        <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
          Значения сохраняются в БД и используются с приоритетом над <code className="rounded bg-[#F1F5F9] px-1.5">.env</code>. Секреты хранятся в зашифрованном виде. Пустые поля секретов — не менять текущее значение. NEXTAUTH_SECRET и DATABASE_URL задаются только в .env.
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
              if (envVars.telegram_webhook_secret.trim()) body.telegram_webhook_secret = envVars.telegram_webhook_secret;
              if (envVars.cron_secret.trim()) body.cron_secret = envVars.cron_secret;
              if (envVars.openai_api_key.trim()) body.openai_api_key = envVars.openai_api_key;
              if (envVars.deepseek_api_key.trim()) body.deepseek_api_key = envVars.deepseek_api_key;
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
                      telegram_webhook_secret: !!body.telegram_webhook_secret || prev.telegram_webhook_secret,
                      cron_secret: !!body.cron_secret || prev.cron_secret,
                      nextauth_url: body.nextauth_url ?? prev.nextauth_url,
                      openai_api_key: !!body.openai_api_key || prev.openai_api_key,
                      deepseek_api_key: !!body.deepseek_api_key || prev.deepseek_api_key,
                    }
                  : null
              );
              if (body.resend_api_key) setEnvVars((p) => ({ ...p, resend_api_key: '' }));
              if (body.telegram_bot_token) setEnvVars((p) => ({ ...p, telegram_bot_token: '' }));
              if (body.telegram_webhook_secret) setEnvVars((p) => ({ ...p, telegram_webhook_secret: '' }));
              if (body.cron_secret) setEnvVars((p) => ({ ...p, cron_secret: '' }));
              if (body.openai_api_key) setEnvVars((p) => ({ ...p, openai_api_key: '' }));
              if (body.deepseek_api_key) setEnvVars((p) => ({ ...p, deepseek_api_key: '' }));
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
            <Label htmlFor="env_telegram_webhook_secret">Telegram Webhook Secret</Label>
            <Input
              id="env_telegram_webhook_secret"
              type="password"
              value={envVars.telegram_webhook_secret}
              onChange={(e) => setEnvVars((p) => ({ ...p, telegram_webhook_secret: e.target.value }))}
              placeholder={keys?.telegram_webhook_secret ? 'Оставьте пустым, чтобы не менять' : 'X-Telegram-Bot-Api-Secret-Token'}
              className="mt-1"
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-[var(--portal-text-muted)]">Секрет для проверки webhook Telegram (заголовок X-Telegram-Bot-Api-Secret-Token).</p>
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
            <Label htmlFor="env_openai_api_key">OpenAI API ключ (генерация обложек курсов, DALL·E)</Label>
            <Input
              id="env_openai_api_key"
              type="password"
              value={envVars.openai_api_key}
              onChange={(e) => setEnvVars((p) => ({ ...p, openai_api_key: e.target.value }))}
              placeholder={keys?.openai_api_key ? 'Оставьте пустым, чтобы не менять' : 'sk-...'}
              className="mt-1"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="env_deepseek_api_key">DeepSeek API ключ (запасной для чата и тьютора)</Label>
            <Input
              id="env_deepseek_api_key"
              type="password"
              value={envVars.deepseek_api_key}
              onChange={(e) => setEnvVars((p) => ({ ...p, deepseek_api_key: e.target.value }))}
              placeholder={keys?.deepseek_api_key ? 'Оставьте пустым, чтобы не менять' : 'Основные ключи — в Настройки AI'}
              className="mt-1"
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-[var(--portal-text-muted)]">Используется, если в Настройки AI не заданы сохранённые ключи.</p>
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
          <p className="text-xs text-[var(--portal-text-muted)]">
            Тестовое письмо уходит на адрес из блока «Почта». Telegram: проверка токена через getMe.
          </p>
        </form>
      </div>

      <div className="portal-card p-6">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Импорт из переменных окружения процесса</h2>
        <p className="mt-1 text-sm text-[var(--portal-text-muted)] max-w-2xl">
          После первого деплоя можно перенести значения из <code className="rounded bg-[#F1F5F9] px-1">.env</code> на сервере в БД одной операцией.
          Перезаписываются только те ключи, для которых в окружении процесса задано непустое значение.{' '}
          <code className="rounded bg-[#F1F5F9] px-1">DATABASE_URL</code> и{' '}
          <code className="rounded bg-[#F1F5F9] px-1">NEXTAUTH_SECRET</code> сюда не входят — их задают только в панели хостинга.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          disabled={importingEnv}
          onClick={() => setConfirmImportEnvOpen(true)}
        >
          {importingEnv ? 'Импорт…' : 'Импортировать из env процесса…'}
        </Button>
        <ConfirmDialog
          open={confirmImportEnvOpen}
          onOpenChange={setConfirmImportEnvOpen}
          title="Импорт настроек из окружения?"
          description="Будут записаны в БД все совпадения с переменными окружения текущего процесса (см. docs/Env-Config.md). Уже сохранённые значения для этих ключей будут заменены."
          confirmLabel="Импортировать"
          onConfirm={async () => {
            setImportingEnv(true);
            try {
              const res = await fetch('/api/portal/admin/settings/import-env', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: true }),
              });
              const data = await res.json();
              if (!res.ok) {
                toast.error(typeof data.error === 'string' ? data.error : 'Ошибка импорта');
                return;
              }
              toast.success(`Импортировано ключей: ${data.imported?.length ?? 0}. Обновление страницы…`);
              window.location.reload();
            } catch {
              toast.error('Ошибка запроса');
            } finally {
              setImportingEnv(false);
              setConfirmImportEnvOpen(false);
            }
          }}
        />
      </div>
    </div>
  );
}
