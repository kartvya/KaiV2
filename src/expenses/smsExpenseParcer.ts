import type { RawSms } from '../native/SmsModule';

export interface ParsedExpense {
  smsId: string;
  timestamp: number;
  sender: string;
  amount: number;
  currency: string;
  type: 'debit' | 'credit' | 'unknown';
  merchant?: string;
  accountHint?: string;
  originalBody: string;
  hash: string;
}

const AMOUNT_REGEXES: RegExp[] = [
  /(?:INR|Rs\.?|Rs|₹)\s*([\d,]+\.?\d*)/i,
  /(?:USD|\$)\s*([\d,]+\.?\d*)/,
  /amount\s*[:\-]?\s*(?:INR|Rs\.?|Rs|₹)?\s*([\d,]+\.?\d*)/i,
];

const CURRENCY_REGEX = /(INR|Rs\.?|Rs|₹|USD|\$)/i;
const DEBIT_HINT =
  /\b(debited|spent|purchase|pos|atm|withdrawn|txn(?:\.|) charges?)\b/i;
const CREDIT_HINT = /\b(credited|received|refund|cashback|deposit)\b/i;
const ACCOUNT_HINT =
  /\b(?:a\/c|ac|acct|account)\s*(?:xx|x|ending|no\.?|number|#)?\s*[:\-]?\s*([Xx\*0-9]{3,})/i;
const MERCHANT_HINT = /\b(?:at|to)\s+([A-Za-z0-9&\-\._ ]{2,25})\b/;

function normalizeAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''));
}

function hash(str: string): string {
  let h = 0,
    i = 0,
    len = str.length;
  while (i < len) {
    h = (Math.imul(31, h) + str.charCodeAt(i++)) | 0;
  }
  return (h >>> 0).toString(16);
}

export function parseExpenseFromSms(sms: RawSms): ParsedExpense | null {
  const body = sms.body;
  if (!body) return null;

  // Filter OTP-like quickly
  if (/otp/i.test(body) && !/(debited|credited|amount)/i.test(body))
    return null;

  // Extract amount
  let amount: number | null = null;
  for (const re of AMOUNT_REGEXES) {
    const m = body.match(re);
    if (m && m[1]) {
      amount = normalizeAmount(m[1]);
      break;
    }
  }
  if (amount == null || isNaN(amount)) return null;

  const currencyMatch = body.match(CURRENCY_REGEX);
  const currency = currencyMatch
    ? currencyMatch[1]
        .toUpperCase()
        .replace(/Rs\.?/i, 'INR')
        .replace('₹', 'INR')
        .replace('$', 'USD')
    : 'INR';

  let type: ParsedExpense['type'] = 'unknown';
  if (DEBIT_HINT.test(body)) type = 'debit';
  else if (CREDIT_HINT.test(body)) type = 'credit';

  const merchantMatch = body.match(MERCHANT_HINT);
  const merchant = merchantMatch
    ? sanitizeMerchant(merchantMatch[1])
    : undefined;

  const acctMatch = body.match(ACCOUNT_HINT);
  const accountHint = acctMatch
    ? acctMatch[1].replace(/[^Xx0-9*]/g, '')
    : undefined;

  const parsed: ParsedExpense = {
    smsId: sms.id,
    timestamp: sms.date,
    sender: sms.address,
    amount,
    currency,
    type,
    merchant,
    accountHint,
    originalBody: body,
    hash: hash(`${sms.id}:${amount}:${currency}`),
  };

  // Basic heuristic: ignore credits if you only track expenses
  if (parsed.type === 'credit') {
    return null;
  }

  return parsed;
}

function sanitizeMerchant(raw: string): string {
  return raw
    .trim()
    .replace(/\s{2,}/g, ' ')
    .slice(0, 40);
}

export function parseExpenses(smsList: RawSms[]): ParsedExpense[] {
  const out: ParsedExpense[] = [];
  for (const sms of smsList) {
    const p = parseExpenseFromSms(sms);
    if (p) out.push(p);
  }
  return out;
}
