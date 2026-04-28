/**
 * Общие типы клиента PayKeeper (JSON API + webhook).
 */

export interface PayKeeperConfig {
  server: string;
  login: string;
  password: string;
  secret: string;
}

/** Данные для выставления счёта (/change/invoice/preview/). */
export type PaymentData = {
  sum: number;
  orderid: string;
  clientid: string;
  /**
   * Строка с названием услуги или JSON-объект по доке PayKeeper
   * (cart, receipt_properties, lang, user_result_callback, service_name).
   */
  service_name: string | Record<string, unknown>;
  client_email: string;
  client_phone?: string;
  /** URL редиректа после оплаты (в JSON service_name попадёт как user_result_callback, иначе отдельным полем формы). */
  successRedirectUrl?: string;
};

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type CreatePayKeeperInvoiceResult = {
  paymentUrl: string;
  invoiceId: string;
};
