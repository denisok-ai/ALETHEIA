'use client';

import { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Contact() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    const form = e.currentTarget;
    const formData = new FormData(form);
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
      } else setStatus('error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <section id="contact" ref={ref} className="relative py-24 px-4 bg-gradient-to-b from-lavender/20 to-bg">
      <motion.div
        style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, rotateX: 18 }}
        animate={isInView ? { opacity: 1, rotateX: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-6xl"
      >
        <div className="grid gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
          >
            <span className="block text-sm font-semibold uppercase tracking-widest text-accent">
              Записаться
            </span>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-dark sm:text-4xl">
              Оставьте заявку
            </h2>
            <p className="mt-4 text-text-muted">
              Мы свяжемся с вами и подберём формат: консультация, тренинг или курс.
            </p>
            <div className="mt-8">
              <p className="font-heading text-lg font-semibold text-dark">
                Татьяна Стрельцова
              </p>
              <ul className="mt-2 space-y-1 text-text-muted">
                <li>
                  <a href="tel:+74951234567" className="hover:text-accent transition-colors">
                    +7 (495) 123-45-67
                  </a>
                </li>
                <li>
                  <a href="mailto:info@aletheia.ru" className="hover:text-accent transition-colors">
                    info@aletheia.ru
                  </a>
                </li>
                <li>Москва, ул. Здоровья, д. 10</li>
              </ul>
              <p className="mt-4 text-sm text-text-soft">
                Партнёры: Институт им. Энгельгардта, РНИМУ им. Пирогова
              </p>
            </div>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border bg-white p-6"
          >
            <div className="space-y-4">
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
                  className="mt-1 flex w-full rounded-lg border border-border bg-bg px-4 py-2 text-dark placeholder:text-text-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={status === 'sending'}
              >
                {status === 'sending' && 'Отправка…'}
                {status === 'sent' && 'Заявка отправлена'}
                {status === 'error' && 'Ошибка. Попробуйте снова'}
                {status === 'idle' && 'Отправить заявку'}
              </Button>
            </div>
          </motion.form>
        </div>
      </motion.div>
    </section>
  );
}
