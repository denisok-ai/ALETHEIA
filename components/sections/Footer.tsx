import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Mail, MapPin, Phone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-soft py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 md:grid-cols-3 text-center md:text-left">
          <div>
            <Link
              href="#hero"
              className="font-heading text-xl font-semibold text-dark hover:text-accent transition-colors"
            >
              ALETHEIA
            </Link>
            <p className="mt-2 text-sm text-text-muted">
              Школа подсознания и мышечного тестирования
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-dark mb-2">Контакты</p>
            <ul className="space-y-1 text-sm text-text-muted">
              <li>
                <a href="tel:+74951234567" className="flex items-center justify-center gap-2 md:justify-start hover:text-accent">
                  <Phone className="h-4 w-4" /> +7 (495) 123-45-67
                </a>
              </li>
              <li>
                <a href="mailto:info@aletheia.ru" className="flex items-center justify-center gap-2 md:justify-start hover:text-accent">
                  <Mail className="h-4 w-4" /> info@aletheia.ru
                </a>
              </li>
              <li className="flex items-center justify-center gap-2 md:justify-start">
                <MapPin className="h-4 w-4" /> Москва, ул. Здоровья, д. 10
              </li>
            </ul>
          </div>
          <div>
            <Link href="#pricing" className="inline-block">
              <Button variant="primary">Купить курс</Button>
            </Link>
            <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-4 text-xs text-text-soft">
              <Link href="/oferta" className="hover:text-accent">Оферта</Link>
              <Link href="/privacy" className="hover:text-accent">Политика конфиденциальности</Link>
            </div>
          </div>
        </div>
        <p className="mt-8 pt-6 border-t border-border text-center text-xs text-text-soft">
          © ALETHEIA. ИП Стрельцова Т. (ОГРН и реквизиты уточняются)
        </p>
      </div>
    </footer>
  );
}
