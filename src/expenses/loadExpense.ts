import { fetchLast3MonthsTransactionSms } from '../native/SmsModule';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseExpenses } from './smsExpenseParcer';

const LAST_SYNC_KEY = 'sms_last_sync_timestamp';

export async function syncExpenses() {
  const lastSyncRaw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  const lastSync = lastSyncRaw ? parseInt(lastSyncRaw, 10) : undefined;

  // If we have synced before, only fetch from last sync to now, else 3 months window.
  const now = Date.now();
  let since = lastSync && lastSync > 0 ? lastSync : undefined;
  if (!since) {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    since = d.getTime();
  }

  const messages = await fetchLast3MonthsTransactionSms({
    bankSenders: [
      // Add uppercase sender IDs typical for banks in your region
      'HDFCBK',
      'ICICIB',
      'SBIINB',
      'AXISBK',
      'KOTAKB',
      'PNBSMS',
    ],
    includeRegex: '(?i)(debited|spent|purchase|txn|amount|rs\\.?|inr)',
    excludeRegex: '(?i)(otp|one time password)',
  });

  // Filter by since just in case
  const filtered = messages.filter(m => m.date >= since!);

  const expenses = parseExpenses(filtered);

  // Store or merge into database (Realm/SQLite/Watermelon/etc.)
  // For demo:
  console.log('Parsed expenses count', expenses.length);

  await AsyncStorage.setItem(LAST_SYNC_KEY, now.toString());

  return expenses;
}
