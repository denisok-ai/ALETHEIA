import { NextRequest, NextResponse } from 'next/server';
import { createPayKeeperInvoice } from '@/lib/paykeeper';
import { createClient } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';

const TARIFFS: Record<string, { name: string; price: number }> = {
  consult: { name: 'Индивидуальная консультация', price: 5000 },
  group: { name: 'Групповой тренинг', price: 3000 },
  course: { name: 'Курс ALETHEIA', price: 25000 },
  online: { name: 'Онлайн-консультация', price: 3500 },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tariffId, email, name, phone } = body;
    if (!tariffId || !email || !name) {
      return NextResponse.json(
        { error: 'Не указаны tariffId, email или name' },
        { status: 400 }
      );
    }

    const tariff = TARIFFS[tariffId];
    if (!tariff) {
      return NextResponse.json({ error: 'Тариф не найден' }, { status: 404 });
    }

    const orderNumber = `ALT-${nanoid(10)}`;

    const supabase = createClient();
    if (supabase) {
      try {
        await supabase.from('orders').insert({
          order_number: orderNumber,
          tariff_id: tariffId,
          amount: tariff.price,
          client_email: email,
          client_phone: phone ?? null,
          status: 'pending',
        });
      } catch (dbErr) {
        console.error('DB insert order:', dbErr);
      }
    }

    let paymentUrl: string;
    try {
      paymentUrl = await createPayKeeperInvoice({
        sum: tariff.price,
        orderid: orderNumber,
        clientid: email,
        service_name: `ALETHEIA — ${tariff.name}`,
        client_email: email,
        client_phone: phone || undefined,
      });
    } catch (pkErr) {
      console.error('PayKeeper create invoice:', pkErr);
      return NextResponse.json(
        {
          error: 'Ошибка создания платежа. Проверьте настройки PayKeeper.',
          success: false,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentUrl,
      orderNumber,
    });
  } catch (error) {
    console.error('Payment create error:', error);
    return NextResponse.json(
      { error: 'Ошибка создания платежа', success: false },
      { status: 500 }
    );
  }
}
