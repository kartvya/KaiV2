import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

// Native + parsing helpers you added (adjust relative paths if different)
import { ParsedExpense, parseExpenses } from './src/expenses/smsExpenseParcer';
import {
  ensureSmsPermission,
  fetchLast3MonthsTransactionSms,
  RawSms,
} from './src/native/SmsModule';

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [rawMessages, setRawMessages] = useState<RawSms[]>([]);
  const [expenses, setExpenses] = useState<ParsedExpense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const firstLoadRef = useRef(false);

  const requestPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Unsupported', 'SMS reading only works on Android');
      return false;
    }
    const granted = await ensureSmsPermission();
    setPermissionGranted(granted);
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Expense tracking needs SMS access to parse transaction messages.',
      );
    }
    return granted;
  }, []);

  const loadExpenses = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      // Ensure permission each time (in case user revoked)
      const ok = await requestPermission();
      if (!ok) {
        setLoading(false);
        return;
      }

      // You can tweak include/exclude regex here depending on which messages you want
      const msgs = await fetchLast3MonthsTransactionSms({
        includeRegex: '(?i)(debited|spent|purchase|txn|amount|rs\\.?|inr|paid)',
        excludeRegex: '(?i)(otp|one time password|verification)',
        // Add sender filtering if you’ve collected a list of bank IDs:
        bankSenders: ['HDFCBK', 'ICICIB', 'SBIINB'],
      });

      setRawMessages(msgs);

      const parsed = parseExpenses(msgs);
      setExpenses(parsed);
    } catch (e: any) {
      console.warn('Failed to load expenses', e);
      setError(e?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [requestPermission]);

  useEffect(() => {
    if (!firstLoadRef.current) {
      firstLoadRef.current = true;
      loadExpenses();
    }
  }, [loadExpenses]);

  return (
    <View>
      <Text>Hello</Text>
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  permissionBox: {
    margin: 16,
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 10,
  },
  permissionText: {
    color: '#E2E8F0',
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  permissionButton: {
    color: '#93C5FD',
    fontWeight: '600',
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#7F1D1D',
    padding: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#FEE2E2',
    fontSize: 12,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    paddingHorizontal: 6,
  },
  summaryLabel: {
    color: '#8893A2',
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '500',
  },
  summaryValue: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
  },
  summaryValueSmall: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
    paddingBottom: 80,
  },
  expenseRow: {
    flexDirection: 'row',
    backgroundColor: '#16202C',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  amountText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  merchantText: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  accountHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  metaCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  dateText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  typeBadge: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 13,
    paddingHorizontal: 24,
  },
  loadingOverlay: {
    alignItems: 'center',
    marginTop: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#CBD5E1',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  footerText: {
    fontSize: 11,
    color: '#6B7280',
  },
});
