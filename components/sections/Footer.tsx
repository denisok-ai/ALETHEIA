import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Mail, MapPin, Phone } from 'lucide-react';

interface FooterProps {
  /** Из настроек портала (БД). Если не задан — показывается заглушка. */
  contactPhone?: string | null;
}

export function Footer({ contactPhone }: FooterProps) {
  const phone = contactPhone?.trim() || '+7 (495) 123-45-67';
  const phoneHref = phone.replace(/\D/g, '').length >= 10 ? `tel:${phone.replace(/\D/g, '')}` : '#';
  return (
    <footer id="footer" className="border-t border-border/80 bg-bg-soft py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-5 md:px-6">
        <div className="grid gap-12 md:grid-cols-3 text-center md:text-left">
          <div>
            <Link
              href="#hero"
              className="inline-flex items-center gap-2 font-heading text-xl font-semibold text-dark hover:text-accent transition-colors"
            >
              <Image
                src="/images/avaterra-logo.png"
                alt=""
                width={63}
                height={63}
                className="h-[3.9375rem] w-[3.9375rem] shrink-0 object-contain"
              />
              AVATERRA
            </Link>
            <p className="mt-2 text-sm text-text-muted">
              Phygital школа мышечного тестирования
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-dark mb-2">Контакты</p>
            <ul className="space-y-1 text-sm text-text-muted">
              <li>
                <a href={phoneHref} className="flex items-center justify-center gap-2 md:justify-start hover:text-accent">
                  <Phone className="h-4 w-4" /> {phone}
                </a>
              </li>
              <li>
                <a href="mailto:info@avaterra.pro" className="flex items-center justify-center gap-2 md:justify-start hover:text-accent">
                  <Mail className="h-4 w-4" /> info@avaterra.pro
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
        <p className="mt-12 pt-8 border-t border-border/80 text-center text-xs text-text-soft">
          © AVATERRA. ИП Стрельцова Т. (ОГРН и реквизиты уточняются)
        </p>
      </div>
    </footer>
  );
}
