import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

const { SmsModule } = NativeModules as {
  SmsModule: {
    getMessages(options: {
      limit?: number;
      max?: number; // legacy
      address?: string;
      addresses?: string[];
      bodyRegex?: string;
      excludeBodyRegex?: string;
      since?: number;
      until?: number;
      box?: 'inbox' | 'sent' | 'draft';
    }): Promise<RawSms[]>;
  };
};

export interface RawSms {
  id: string;
  threadId?: string;
  address: string;
  body: string;
  date: number; // ms
  type: number;
  read: boolean;
}

export async function ensureSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    {
      title: 'SMS Permission',
      message: 'We need to read transaction SMS for expense tracking.',
      buttonPositive: 'Allow',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function threeMonthsAgo(): number {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.getTime();
}

export async function fetchLast3MonthsTransactionSms(options?: {
  limit?: number;
  bankSenders?: string[];
  includeRegex?: string;
  excludeRegex?: string;
}): Promise<RawSms[]> {
  if (Platform.OS !== 'android') throw new Error('Android only');
  const ok = await ensureSmsPermission();
  if (!ok) throw new Error('READ_SMS permission denied');

  const now = Date.now();
  const since = threeMonthsAgo();

  return SmsModule.getMessages({
    limit: options?.limit ?? 800,
    addresses: options?.bankSenders,
    since,
    until: now,
    bodyRegex: options?.includeRegex, // e.g. "(?i)(debited|purchase|spent|txn|amount)"
    excludeBodyRegex: options?.excludeRegex, // e.g. "(?i)(otp|one time password)"
  });
}
