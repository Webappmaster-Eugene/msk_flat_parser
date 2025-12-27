import { SimpleResult } from '../scraper/parser';

export function formatAvailableAlert(profileName: string, result: SimpleResult): string {
  const lines: string[] = [];

  lines.push('🎉🎉🎉 *ВНИМАНИЕ! СВОБОДНАЯ КВАРТИРА!* 🎉🎉🎉');
  lines.push('');
  lines.push(`📋 Профиль: ${profileName}`);
  lines.push(`📅 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`);
  lines.push('');
  lines.push('─'.repeat(20));
  lines.push('');
  lines.push(`✅ Найдено кнопок НЕ "Забронировано": *${result.availableButtons.length}*`);
  lines.push(`📊 Всего кнопок: ${result.totalButtons}`);
  lines.push(`🔒 Забронировано: ${result.bookedButtons}`);
  lines.push('');

  if (result.availableButtons.length > 0) {
    lines.push('*Тексты доступных кнопок:*');
    result.availableButtons.forEach((btn, idx) => {
      lines.push(`${idx + 1}. "${btn.text}"`);
    });
  }

  lines.push('');
  lines.push('─'.repeat(20));
  lines.push('');
  lines.push('🏃 *СРОЧНО ПРОВЕРЬТЕ САЙТ!*');
  lines.push('[Открыть сайт](https://москварталы.рф/kvartiry/?property=семейная&floor[]=4;17&area[]=28;34&price[]=8;12&price_m[]=330.5;380.5&district=2594)');

  return lines.join('\n');
}

export function formatStartupMessage(): string {
  return `🚀 *Мониторинг квартир запущен*\n\n📅 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}\n\nБот отслеживает кнопки квартир.\nЕсли хоть одна кнопка изменится с "Забронировано" на что-то другое — вы получите уведомление.`;
}

export function formatErrorMessage(error: string): string {
  return `⚠️ *Ошибка мониторинга*\n\n${error}\n\n📅 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;
}

export function formatHeartbeatMessage(stats: { totalChecks: number; lastCheckTime: Date | null; totalApartments: number; bookedCount: number }): string {
  const lines: string[] = [];
  
  lines.push('💚 *Бот работает нормально*');
  lines.push('');
  lines.push(`📅 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`);
  lines.push('');
  lines.push('─'.repeat(20));
  lines.push('');
  lines.push(`📊 Проверок с запуска: ${stats.totalChecks}`);
  
  if (stats.lastCheckTime) {
    lines.push(`🕐 Последняя проверка: ${stats.lastCheckTime.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`);
  }
  
  lines.push(`🏠 Квартир в последней проверке: ${stats.totalApartments}`);
  lines.push(`🔒 Из них забронировано: ${stats.bookedCount}`);
  lines.push('');
  lines.push('─'.repeat(20));
  lines.push('');
  lines.push('_Следующий отчёт через 6 часов_');

  return lines.join('\n');
}
