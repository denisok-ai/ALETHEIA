/**
 * Типовые шаблоны CommsTemplate для скрипта upsert и документации.
 * Плейсхолдеры в стиле рассылок: %FirstName%, %LastName%, %date%, %systemtitle%, др.
 */

export type CommsTemplateSeed = {
  name: string;
  channel: 'email' | 'telegram';
  subject: string | null;
  htmlBody: string | null;
  variables: string;
};

/** Стабильные имена с префиксом `[AVATERRA]` — по ним скрипт ищет существующие записи. */
export const DEFAULT_COMMS_TEMPLATE_SEEDS: CommsTemplateSeed[] = [
  {
    name: '[AVATERRA] Приветствие нового ученика',
    channel: 'email',
    subject: 'Добро пожаловать в %systemtitle%',
    htmlBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Вы успешно зарегистрировались на образовательном портале <strong>%systemtitle%</strong>. Личный кабинет — ваш главный вход к программам: материалы курсов, прогресс, сертификаты и диалог со службой поддержки всегда под рукой.</p>
<p>Рекомендуем начать с раздела <strong>«Мои курсы»</strong>: там отображаются все активные программы и статус прохождения. При необходимости загляните в <strong>«Профиль»</strong>, чтобы проверить контактные данные.</p>
<p>Если что-то непонятно с доступом или входом — напишите нам через форму поддержки или ответьте на это письмо.</p>
<p>С уважением,<br/>Команда %systemtitle%</p>
<p style="font-size:12px;color:#5c5854;">Дата: %date%.</p>`,
    variables: JSON.stringify(['FirstName', 'LastName', 'date', 'systemtitle']),
  },
  {
    name: '[AVATERRA] Старт обучения',
    channel: 'email',
    subject: 'Обучение начинается — %systemtitle%',
    htmlBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Стартует программа <strong>%coursename%</strong>. Откройте раздел <strong>«Мои курсы»</strong>, выберите курс и приступайте к первому доступному модулю или продолжите с сохранённой точки.</p>
<p>Заложите удобный для себя ритм: даже короткие регулярные занятия дают стабильный результат лучше, чем редкие длинные сессии.</p>
<p>При вопросах по содержанию или технической части обращайтесь в поддержку портала.</p>
<p>Успехов!<br/>%systemtitle%</p>
<p style="font-size:12px;color:#5c5854;">Дата: %date%.</p>`,
    variables: JSON.stringify(['FirstName', 'LastName', 'date', 'systemtitle', 'coursename']),
  },
  {
    name: '[AVATERRA] Напоминание о прохождении курса',
    channel: 'email',
    subject: 'Напоминание: продолжите курс — %systemtitle%',
    htmlBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Напоминаем о программе <strong>%coursename%</strong>: материалы ждут вас в личном кабинете. Вы можете продолжить в любое время — прогресс и статус уроков сохраняются.</p>
<p>Если долго не заходили — это хороший момент запланировать одно занятие на ближайшие дни; маленький шаг возвращает к ритму обучения.</p>
<p>Трудности с доступом или пониманием заданий решаются через поддержку — не откладывайте запрос, мы на связи.</p>
<p>С наилучшими пожеланиями,<br/>%systemtitle%</p>
<p style="font-size:12px;color:#5c5854;">Дата: %date%.</p>`,
    variables: JSON.stringify(['FirstName', 'LastName', 'date', 'systemtitle', 'coursename']),
  },
  {
    name: '[AVATERRA] Напоминание о задании или верификации',
    channel: 'email',
    subject: 'Требуется действие по курсу — %systemtitle%',
    htmlBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>По программе <strong>%coursename%</strong> ожидается ваш шаг: выполнение задания и/или отправка результата на проверку (верификацию). Без этого шага может быть недоступен следующий модуль или итоговый документ.</p>
<p>Все инструкции и статусы отображаются в интерфейсе курса в разделе <strong>«Мои курсы»</strong>. Проверьте описание задания и при необходимости прикрепите файлы в форме сдачи.</p>
<p>Если дедлайн или формат неясны — напишите в поддержку с указанием названия курса.</p>
<p>%systemtitle%</p>
<p style="font-size:12px;color:#5c5854;">Дата: %date%.</p>`,
    variables: JSON.stringify(['FirstName', 'LastName', 'date', 'systemtitle', 'coursename']),
  },
  {
    name: '[AVATERRA] Выдача сертификата',
    channel: 'email',
    subject: 'Ваш сертификат — %systemtitle%',
    htmlBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Поздравляем! По программе <strong>%coursename%</strong> вам доступен сертификат в электронном виде. Скачать PDF можно в разделе <strong>«Мои сертификаты»</strong> личного кабинета.</p>
<p>Проверьте корректность персональных данных в документе. Если нужна замена или исправление — сообщите в поддержку с приложением скриншота или описанием ошибки.</p>
<p>Спасибо за участие и применение навыков AVATERRA на практике!</p>
<p>С уважением,<br/>Команда %systemtitle%</p>
<p style="font-size:12px;color:#5c5854;">Дата: %date%.</p>`,
    variables: JSON.stringify(['FirstName', 'LastName', 'date', 'systemtitle', 'coursename']),
  },
  {
    name: '[AVATERRA] Сервисное уведомление',
    channel: 'email',
    subject: 'Уведомление от %systemtitle%',
    htmlBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Служебное сообщение для пользователей портала <strong>%systemtitle%</strong>.</p>
<p><strong>Суть:</strong> %message%</p>
<p>При необходимости уточнений используйте раздел поддержки или ответ на это письмо.</p>
<p>С уважением,<br/>Администрация %systemtitle%</p>
<p style="font-size:12px;color:#5c5854;">Дата: %date%.</p>`,
    variables: JSON.stringify(['FirstName', 'LastName', 'date', 'systemtitle', 'message']),
  },
  {
    name: '[AVATERRA] Новостная рассылка',
    channel: 'email',
    subject: 'Новости %systemtitle% — %date%',
    htmlBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Дайджест новостей и анонсов школы <strong>%systemtitle%</strong>.</p>
<hr style="border:none;border-top:1px solid #e8e4de;margin:16px 0;" />
<p><em>Вставьте здесь текст новости или несколько блоков (можно HTML): анонсы курсов, статьи, даты событий.</em></p>
<hr style="border:none;border-top:1px solid #e8e4de;margin:16px 0;" />
<p>Больше материалов — на портале в вашем личном кабинете.</p>
<p style="font-size:12px;color:#5c5854;"><a href="%unsubscribe%" style="color:#2D1B4E;text-decoration:underline;">Отписаться от рассылок</a></p>`,
    variables: JSON.stringify(['FirstName', 'LastName', 'date', 'systemtitle', 'unsubscribe']),
  },
  {
    name: '[AVATERRA] Приглашение на консультацию или мероприятие',
    channel: 'email',
    subject: 'Приглашение — %systemtitle%',
    htmlBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Приглашаем вас на событие: <strong>%eventtitle%</strong>. Это может быть консультация, вебинар, практический семинар или встреча команды — уточните формат и программу при отправке рассылки.</p>
<p><strong>Как принять участие:</strong> следуйте инструкции из личного кабинета или подтвердите участие ответом на это письмо, если так задумано организатором.</p>
<p>Если нужно перенести дату или задать вопрос до события — напишите в поддержку.</p>
<p>Будем рады видеть вас!<br/>%systemtitle%</p>
<p style="font-size:12px;color:#5c5854;">Дата: %date%.</p>`,
    variables: JSON.stringify(['FirstName', 'LastName', 'date', 'systemtitle', 'eventtitle']),
  },
  {
    name: '[AVATERRA] Ответ поддержки',
    channel: 'email',
    subject: 'Ответ службы поддержки — %systemtitle%',
    htmlBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Служба поддержки портала <strong>%systemtitle%</strong> отвечает на ваш запрос:</p>
<div style="margin:14px 0;padding:14px;border-left:3px solid #D4AF37;background:#f9f8f6;">
%reply%
</div>
<p>Если ответ закрывает вопрос — ничего делать не нужно. Если нужна дополнительная помощь, ответьте на это письмо или откройте тикет в кабинете с тем же номером обращения.</p>
<p>С уважением,<br/>Поддержка %systemtitle%</p>
<p style="font-size:12px;color:#5c5854;">Дата: %date%.</p>`,
    variables: JSON.stringify(['FirstName', 'LastName', 'date', 'systemtitle', 'reply']),
  },
];
