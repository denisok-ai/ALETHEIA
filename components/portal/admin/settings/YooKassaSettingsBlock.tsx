'use client';

/**
 * Портал → Настройки → Платежи: провайдер онлайн-оплаты и блок ЮKassa.
 * Секреты только записываются: сохранённое значение не показывается, пустое поле не меняет секрет.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Label } from '@/components/ui/label';
import { PAYMENT_MODES, PAYMENT_SUBJECTS } from '@/lib/yookassa/payloads';

const TAX_OPTIONS: Array<[string, string]> = [
  ['1', '1 — общая система налогообложения (ОСН)'],
  ['2', '2 — УСН «доходы»'],
  ['3', '3 — УСН «доходы минус расходы»'],
  ['4', '4 — ЕНВД'],
  ['5', '5 — ЕСХН'],
  ['6', '6 — патентная система'],
];

const VAT_OPTIONS: Array<[string, string]> = [
  ['1', '1 — без НДС'],
  ['2', '2 — НДС 0%'],
  ['3', '3 — НДС 10%'],
  ['4', '4 — НДС 20%'],
  ['5', '5 — НДС 10/110'],
  ['6', '6 — НДС 20/120'],
  ['7', '7 — НДС 5%'],
  ['8', '8 — НДС 7%'],
  ['9', '9 — НДС 5/105'],
  ['10', '10 — НДС 7/107'],
  ['11', '11 — НДС 22%'],
  ['12', '12 — НДС 22/122'],
];

const SUBJECT_LABELS: Record<string, string> = {
  service: 'услуга',
  commodity: 'товар',
  job: 'работа',
  payment: 'платёж',
  another: 'иное',
};

const MODE_LABELS: Record<string, string> = {
  full_payment: 'полный расчёт',
  full_prepayment: 'полная предоплата',
  partial_prepayment: 'частичная предоплата',
  advance: 'аванс',
  partial_payment: 'частичный расчёт',
  credit: 'кредит',
  credit_payment: 'оплата кредита',
};

type Keys = Record<string, unknown>;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const flag = (v: unknown) => v === true || v === '1' || v === 'true';

export function YooKassaSettingsBlock() {
  const [loaded, setLoaded] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');
  const [provider, setProvider] = useState<'paykeeper' | 'yookassa'>('paykeeper');

  const [useTest, setUseTest] = useState(false);
  const [shopId, setShopId] = useState('');
  const [secret, setSecret] = useState('');
  const [secretSaved, setSecretSaved] = useState(false);
  const [testShopId, setTestShopId] = useState('');
  const [testSecret, setTestSecret] = useState('');
  const [testSecretSaved, setTestSecretSaved] = useState(false);

  const [receipts, setReceipts] = useState(false);
  const [taxCode, setTaxCode] = useState('2');
  const [vatCode, setVatCode] = useState('1');
  const [paymentSubject, setPaymentSubject] = useState('service');
  const [paymentMode, setPaymentMode] = useState('full_payment');
  const [returnUrl, setReturnUrl] = useState('');
  const [ipCheck, setIpCheck] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/portal/admin/settings', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { keys?: Keys };
        const k: Keys = data.keys ?? {};
        if (cancelled) return;
        setSiteUrl(str(k.site_url));
        setProvider(str(k.payments_provider) === 'yookassa' ? 'yookassa' : 'paykeeper');
        setUseTest(flag(k.yookassa_use_test));
        setShopId(str(k.yookassa_shop_id));
        setSecretSaved(flag(k.yookassa_secret_key));
        setTestShopId(str(k.yookassa_test_shop_id));
        setTestSecretSaved(flag(k.yookassa_test_secret_key));
        setReceipts(flag(k.yookassa_receipts_enabled));
        setTaxCode(str(k.yookassa_tax_system_code) || '2');
        setVatCode(str(k.yookassa_vat_code) || '1');
        setPaymentSubject(str(k.yookassa_payment_subject) || 'service');
        setPaymentMode(str(k.yookassa_payment_mode) || 'full_payment');
        setReturnUrl(str(k.yookassa_return_url));
        setIpCheck(flag(k.yookassa_ip_check));
        setLoaded(true);
      } catch {
        if (!cancelled) toast.error('Не удалось загрузить настройки ЮKassa');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const webhookUrl = `${(siteUrl || 'https://avaterra.pro').replace(/\/$/, '')}/api/payments/yookassa/webhook`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string> = {
        payments_provider: provider,
        yookassa_use_test: useTest ? '1' : '0',
        yookassa_shop_id: shopId.trim(),
        yookassa_test_shop_id: testShopId.trim(),
        yookassa_receipts_enabled: receipts ? '1' : '0',
        yookassa_tax_system_code: taxCode,
        yookassa_vat_code: vatCode,
        yookassa_payment_subject: paymentSubject,
        yookassa_payment_mode: paymentMode,
        yookassa_return_url: returnUrl.trim(),
        yookassa_ip_check: ipCheck ? '1' : '0',
      };
      if (secret.trim()) body.yookassa_secret_key = secret.trim();
      if (testSecret.trim()) body.yookassa_test_secret_key = testSecret.trim();

      const res = await fetch('/api/portal/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        toast.success('Настройки платежей сохранены');
        if (secret.trim()) setSecretSaved(true);
        if (testSecret.trim()) setTestSecretSaved(true);
        setSecret('');
        setTestSecret('');
      } else {
        toast.error(data.error || 'Не удалось сохранить');
      }
    } catch {
      toast.error('Ошибка запроса');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch('/api/portal/admin/settings/test-yookassa', { method: 'POST' });
      const data = (await res.json()) as {
        success?: boolean;
        accountId?: string;
        status?: string | null;
        test?: boolean;
        error?: string;
      };
      if (data.success) {
        toast.success(
          `ЮKassa доступна: магазин ${data.accountId ?? '—'}, статус ${data.status ?? '—'}${data.test ? ' (тестовый)' : ''}`
        );
      } else {
        toast.error(data.error || 'Ошибка подключения к ЮKassa');
      }
    } catch {
      toast.error('Ошибка запроса');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mt-6 portal-card p-6">
      <h2 className="text-base font-semibold text-[var(--portal-text)]">Платежи (ЮKassa)</h2>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Провайдер выбирает, через какую кассу создаётся платёж при «Приём оплаты: онлайн». Уже созданные
        заказы возвращаются и проводятся через тот провайдер, которым были оплачены. Секреты после сохранения
        не показываются; пустое поле не меняет сохранённый секрет.
      </p>

      <form onSubmit={save} className="mt-4 space-y-4">
        <div>
          <Label htmlFor="yk_provider">Провайдер онлайн-оплаты</Label>
          <select
            id="yk_provider"
            className="mt-1 block w-full max-w-xs rounded-md border border-[var(--portal-border)] bg-[var(--portal-bg)] px-3 py-2 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value === 'yookassa' ? 'yookassa' : 'paykeeper')}
          >
            <option value="paykeeper">PayKeeper</option>
            <option value="yookassa">ЮKassa</option>
          </select>
          <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
            При выбранной ЮKassa мониторинг PayKeeper не выполняет проверку доступности PayKeeper.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="yk_use_test"
            type="checkbox"
            checked={useTest}
            onChange={(e) => setUseTest(e.target.checked)}
          />
          <Label htmlFor="yk_use_test" className="font-normal cursor-pointer">
            Использовать тестовый магазин ЮKassa
          </Label>
        </div>

        {!useTest ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="yk_shop_id">shopId (боевой)</Label>
              <Input id="yk_shop_id" className="mt-1" value={shopId} onChange={(e) => setShopId(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="yk_secret">Секретный ключ (боевой)</Label>
              <PasswordInput
                id="yk_secret"
                className="mt-1"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={secretSaved ? 'Оставьте пустым, чтобы не менять' : 'Секретный ключ магазина'}
                autoComplete="new-password"
              />
              {secretSaved && <p className="mt-1 text-xs text-emerald-700">Секрет сохранён</p>}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="yk_test_shop_id">shopId (тестовый)</Label>
              <Input id="yk_test_shop_id" className="mt-1" value={testShopId} onChange={(e) => setTestShopId(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="yk_test_secret">Секретный ключ (тестовый)</Label>
              <PasswordInput
                id="yk_test_secret"
                className="mt-1"
                value={testSecret}
                onChange={(e) => setTestSecret(e.target.value)}
                placeholder={testSecretSaved ? 'Оставьте пустым, чтобы не менять' : 'Секретный ключ тестового магазина'}
                autoComplete="new-password"
              />
              {testSecretSaved && <p className="mt-1 text-xs text-emerald-700">Секрет сохранён</p>}
            </div>
          </div>
        )}

        <div className="rounded-md border border-[var(--portal-border)] p-4 space-y-4">
          <p className="text-sm font-medium text-[var(--portal-text)]">Чеки 54-ФЗ</p>
          <div className="flex items-center gap-2">
            <input
              id="yk_receipts"
              type="checkbox"
              checked={receipts}
              onChange={(e) => setReceipts(e.target.checked)}
            />
            <Label htmlFor="yk_receipts" className="font-normal cursor-pointer">
              Передавать чек в ЮKassa (чек уходит на email покупателя)
            </Label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="yk_tax">Система налогообложения</Label>
              <select id="yk_tax" className="mt-1 block w-full rounded-md border border-[var(--portal-border)] bg-[var(--portal-bg)] px-3 py-2 text-sm" value={taxCode} onChange={(e) => setTaxCode(e.target.value)}>
                {TAX_OPTIONS.map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="yk_vat">Ставка НДС</Label>
              <select id="yk_vat" className="mt-1 block w-full rounded-md border border-[var(--portal-border)] bg-[var(--portal-bg)] px-3 py-2 text-sm" value={vatCode} onChange={(e) => setVatCode(e.target.value)}>
                {VAT_OPTIONS.map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="yk_subject">Предмет расчёта</Label>
              <select id="yk_subject" className="mt-1 block w-full rounded-md border border-[var(--portal-border)] bg-[var(--portal-bg)] px-3 py-2 text-sm" value={paymentSubject} onChange={(e) => setPaymentSubject(e.target.value)}>
                {PAYMENT_SUBJECTS.map((v) => (
                  <option key={v} value={v}>{SUBJECT_LABELS[v] ?? v}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="yk_mode">Признак способа расчёта</Label>
              <select id="yk_mode" className="mt-1 block w-full rounded-md border border-[var(--portal-border)] bg-[var(--portal-bg)] px-3 py-2 text-sm" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                {PAYMENT_MODES.map((v) => (
                  <option key={v} value={v}>{MODE_LABELS[v] ?? v}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="yk_return">Базовый URL возврата (необязательно)</Label>
            <Input
              id="yk_return"
              className="mt-1"
              value={returnUrl}
              onChange={(e) => setReturnUrl(e.target.value)}
              placeholder={siteUrl || 'https://avaterra.pro'}
            />
            <p className="mt-1 text-xs text-[var(--portal-text-muted)]">Пусто — берётся адрес сайта из «Основные».</p>
          </div>
          <div className="flex items-center gap-2 self-end pb-2">
            <input id="yk_ip_check" type="checkbox" checked={ipCheck} onChange={(e) => setIpCheck(e.target.checked)} />
            <Label htmlFor="yk_ip_check" className="font-normal cursor-pointer">
              Принимать уведомления только с адресов ЮKassa
            </Label>
          </div>
        </div>

        <div className="rounded-md bg-[var(--portal-bg-muted,transparent)] p-3 text-sm">
          <p className="font-medium text-[var(--portal-text)]">Адрес уведомлений для кабинета ЮKassa</p>
          <code className="mt-1 block break-all text-[var(--portal-text)]">{webhookUrl}</code>
          <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
            Включите события: payment.succeeded, payment.canceled, refund.succeeded.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving || !loaded}>
            {saving ? 'Сохранение…' : 'Сохранить ЮKassa'}
          </Button>
          <Button type="button" variant="secondary" disabled={testing || !loaded} onClick={testConnection}>
            {testing ? 'Проверка…' : 'Проверить подключение'}
          </Button>
          <span className="text-xs text-[var(--portal-text-muted)]">Проверяется сохранённая конфигурация.</span>
        </div>
      </form>
    </div>
  );
}
