import { NextRequest, NextResponse } from 'next/server';
import { validatePayKeeperWebhook } from '@/lib/paykeeper';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = typeof value === 'string' ? value : value.toString();
    });

    const secret = process.env.PAYKEEPER_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }
    if (!validatePayKeeperWebhook(params, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const { orderid } = params;
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }
    const { data: order, error } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('order_number', orderid)
      .select()
      .single();

    if (error || !order) {
      console.error('Webhook update order:', error);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const tariffId = (order as { tariff_id: string }).tariff_id;
    const clientEmail = (order as { client_email: string }).client_email;

    const { data: service } = await supabase
      .from('services')
      .select('course_id')
      .eq('paykeeper_tariff_id', tariffId)
      .eq('is_active', true)
      .maybeSingle();

    const courseId = (service as { course_id?: string } | null)?.course_id;

    if (courseId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', clientEmail)
        .maybeSingle();

      const userId = (profile as { id?: string } | null)?.id;
      if (userId) {
        await supabase.from('enrollments').upsert(
          { user_id: userId, course_id: courseId },
          { onConflict: 'user_id,course_id' }
        );
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'enrollment',
          content: { course_id: courseId },
        });
        await supabase
          .from('orders')
          .update({ user_id: userId, updated_at: new Date().toISOString() })
          .eq('order_number', orderid);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
