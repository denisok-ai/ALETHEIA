/**
 * Статусы лида CRM (значения в БД) и русские подписи для UI.
 */
export const CRM_LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
export type CrmLeadStatus = (typeof CRM_LEAD_STATUSES)[number];

/** Списки, фильтры, селекты в таблице и карточке лида */
export const CRM_LEAD_STATUS_LABEL: Record<CrmLeadStatus, string> = {
  new: 'Новый',
  contacted: 'Контакт',
  qualified: 'Квалифицирован',
  converted: 'Конвертирован',
  lost: 'Потерян',
};

/** Воронка на дашборде CRM (множественное число) */
export const CRM_LEAD_STATUS_FUNNEL_LABEL: Record<CrmLeadStatus, string> = {
  new: 'Новые',
  contacted: 'Контакт',
  qualified: 'Квалифицированы',
  converted: 'Конвертированы',
  lost: 'Потеряны',
};
