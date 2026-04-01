'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ContactProps {
  /** Из настроек (БД). Если не задан — заглушка. */
  contactPhone?: string | null;
}

export function Contact({ contactPhone }: ContactProps = {}) {
  const phone = contactPhone?.trim() || '+7 (495) 123-45-67';
  const phoneHref = phone.replace(/\D/g, '').length >= 10 ? `tel:${phone.replace(/\D/g, '')}` : '#';
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setErrorMessage('');
    // Защита от спама: скрытое поле должно оставаться пустым
    if (formData.get('website')) {
      setStatus('error');
      setErrorMessage('Ошибка отправки.');
      return;
    }
    const phone = String(formData.get('phone') ?? '').replace(/\D/g, '');
    if (phone.length < 10) {
      setStatus('error');
      setErrorMessage('Введите номер телефона не короче 10 цифр.');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          phone: formData.get('phone'),
          email: formData.get('email'),
          message: formData.get('message'),
        }),
      });
      if (res.ok) {
        setStatus('sent');
        form.reset();
      } else {
        setStatus('error');
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data?.error || 'Ошибка отправки. Попробуйте снова.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Ошибка отправки. Попробуйте снова.');
    }
  };

  return (
    <section
      id="contact"
      ref={ref}
      className="relative scroll-mt-24 scroll-mb-[100px] border-t border-[var(--border)] bg-[var(--bg)] py-24 px-5 md:py-28 md:px-6"
    >
      <motion.div
        style={reduceMotion ? undefined : { perspective: 1200, transformStyle: 'preserve-3d' }}
        initial={{ opacity: reduceMotion ? 1 : 0, rotateX: reduceMotion ? 0 : 18 }}
        animate={isInView || reduceMotion ? { opacity: 1, rotateX: 0 } : {}}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
        }
        className="mx-auto max-w-6xl"
      >
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <motion.div
            initial={{ opacity: reduceMotion ? 1 : 0, x: reduceMotion ? 0 : -20 }}
            animate={isInView || reduceMotion ? { opacity: 1, x: 0 } : {}}
            transition={reduceMotion ? { duration: 0 } : undefined}
          >
            <span className="block text-sm font-semibold uppercase tracking-widest text-plum">
              Записаться
            </span>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
              Оставьте заявку
            </h2>
            <p className="mt-4 max-w-[var(--prose-max-width)] leading-[var(--leading-body)] text-[var(--text-muted)]">
              Мы свяжемся с вами и подберём формат: консультация, тренинг или курс.
            </p>
            <div className="mt-8">
              <p className="font-heading text-lg font-semibold text-[var(--text)]">
                Татьяна Стрельцова
              </p>
              <ul className="mt-2 space-y-1 text-[var(--text-muted)]">
                <li>
                  <a href={phoneHref} className="hover:text-plum transition-colors">
                    {phone}
                  </a>
                </li>
                <li>
                  <a href="mailto:info@avaterra.pro" className="hover:text-plum transition-colors">
                    info@avaterra.pro
                  </a>
                </li>
                <li>Москва, ул. Здоровья, д. 10</li>
              </ul>
              <p className="mt-4 text-sm text-[var(--text-soft)]">
                Партнёры: Институт им. Энгельгардта, РНИМУ им. Пирогова
              </p>
            </div>
          </motion.div>

          {status === 'sent' ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-[var(--border)] bg-white p-7 shadow-[var(--shadow-soft)] md:p-8 text-center"
            >
              <h3 className="font-heading text-xl font-semibold text-[var(--text)]">Спасибо, заявка принята</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Мы свяжемся с вами в ближайшее время. Если указали email — вам пришло подтверждение.
              </p>
              <a href="#pricing" className="mt-6 inline-block">
                <Button variant="landingRose">Оплатить консультацию или курс</Button>
              </a>
              <p className="mt-4">
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="text-sm text-plum hover:underline"
                >
                  Отправить ещё одну заявку
                </button>
              </p>
            </motion.div>
          ) : (
            <motion.form
              initial={{ opacity: reduceMotion ? 1 : 0, x: reduceMotion ? 0 : 20 }}
              animate={isInView || reduceMotion ? { opacity: 1, x: 0 } : {}}
              transition={reduceMotion ? { duration: 0 } : { delay: 0.1 }}
              onSubmit={handleSubmit}
              className="rounded-2xl border border-[var(--border)] bg-white p-7 shadow-[var(--shadow-soft)] md:p-8"
            >
              <div className="space-y-4">
                {/* Honeypot: скрытое поле против ботов (не заполнять) */}
                <div className="absolute -left-[9999px] w-1 h-1 overflow-hidden" aria-hidden="true">
                  <Label htmlFor="contact-website">Сайт</Label>
                  <Input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>
                <div>
                  <Label htmlFor="name">Имя *</Label>
                  <Input id="name" name="name" required placeholder="Ваше имя" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="phone">Телефон *</Label>
                  <Input id="phone" name="phone" type="tel" required placeholder="+7 (___) ___-__-__" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="email@example.com" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="message">Сообщение</Label>
                  <textarea
                    id="message"
                    name="message"
                    rows={3}
                    placeholder="Интересующий формат или вопрос"
                    className="mt-1 flex w-full rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/25"
                  />
                </div>
                {errorMessage && (
                  <p className="text-sm text-red-600" role="alert">
                    {errorMessage}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="landingPlum"
                  className="w-full"
                  disabled={status === 'sending'}
                >
                  {status === 'sending' && 'Отправка…'}
                  {status === 'error' && 'Ошибка. Попробуйте снова'}
                  {status === 'idle' && 'Отправить заявку'}
                </Button>
                <p className="text-center text-xs leading-snug text-[var(--text-soft)]">
                  Отправляя форму, вы соглашаетесь с{' '}
                  <Link href="/privacy" className="text-plum underline underline-offset-2 hover:opacity-90">
                    политикой конфиденциальности
                  </Link>
                  .
                </p>
              </div>
            </motion.form>
          )}
        </div>
      </motion.div>
    </section>
  );
}
