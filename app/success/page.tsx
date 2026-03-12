import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0]}***${domain}`;
  return `${local.slice(0, 2)}***${domain}`;
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const params = await searchParams;
  const orderNumber = typeof params.order === 'string' ? params.order.trim() : undefined;

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  let enrollments: { course: { title: string } }[] = [];
  let orderInfo: { orderNumber: string; maskedEmail: string } | null = null;

  if (userId) {
    enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: { course: { select: { title: true } } },
      take: 5,
    });
  } else if (orderNumber) {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { orderNumber: true, clientEmail: true, status: true },
    });
    if (order?.status === 'paid' && order.clientEmail) {
      orderInfo = { orderNumber: order.orderNumber, maskedEmail: maskEmail(order.clientEmail) };
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-dark px-4">
      <div className="text-center max-w-lg">
        <h1 className="font-heading text-3xl font-semibold text-[#f5f0e8]">
          Оплата прошла успешно
        </h1>
        {userId && enrollments.length > 0 ? (
          <p className="mt-4 text-white/80">
            Ваш{enrollments.length > 1 ? 'и курсы' : ' курс'} уже в разделе «Мои курсы».
            {enrollments[0]?.course?.title && (
              <> Первый: «{enrollments[0].course.title}».</>
            )}
          </p>
        ) : orderInfo ? (
          <p className="mt-4 text-white/80">
            Заказ № {orderInfo.orderNumber} оплачен. Войдите или зарегистрируйтесь с тем же email, что указали при оплате ({orderInfo.maskedEmail}).
          </p>
        ) : (
          <p className="mt-4 text-white/80">
            Доступ к курсу открывается автоматически по указанному при оплате email.
            Если у вас уже есть аккаунт с этим email — войдите в личный кабинет и перейдите в раздел «Мои курсы».
            Если аккаунта нет — зарегистрируйтесь с тем же email, после чего курс будет доступен.
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {userId ? (
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
