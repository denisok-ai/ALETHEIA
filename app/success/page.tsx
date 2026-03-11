import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default async function SuccessPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-dark px-4">
      <div className="text-center max-w-lg">
        <h1 className="font-heading text-3xl font-semibold text-[#f5f0e8]">
          Оплата прошла успешно
        </h1>
        <p className="mt-4 text-white/80">
          Доступ к курсу открывается автоматически по указанному при оплате email.
          Если у вас уже есть аккаунт с этим email — войдите в личный кабинет и перейдите в раздел «Мои курсы».
          Если аккаунта нет — зарегистрируйтесь с тем же email, после чего курс будет доступен.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {session ? (
            <Link href="/portal/student/courses">
              <Button variant="primary">Перейти в личный кабинет → Мои курсы</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="primary">Войти</Button>
              </Link>
              <Link href="/register">
                <Button variant="secondary">Зарегистрироваться</Button>
              </Link>
            </>
          )}
          <Link href="/">
            <Button variant="ghost" className="text-white/80 hover:text-white">
              На главную
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
