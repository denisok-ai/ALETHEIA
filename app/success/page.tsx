import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function SuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-heading text-3xl font-semibold text-[#f5f0e8]">
          Оплата прошла успешно
        </h1>
        <p className="mt-4 text-white/80">
          Мы свяжемся с вами в ближайшее время и отправим доступ к курсу на указанный email.
        </p>
        <Link href="/" className="mt-8 inline-block">
          <Button variant="primary">Вернуться на главную</Button>
        </Link>
      </div>
    </div>
  );
}
