import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing } from '../../theme';
import { Card, SectionHeader, EmptyState, Divider, ProgressBar, Badge } from '../../components/shared';
import { formatINR, creditUtilizationColor } from '../../utils/finance';
import {
  computeCreditCardOutstandingThisCycle,
  isLoanEmiSubCategory,
  isCreditCardBillPaymentSubCategory,
  splitOutstandingNonEmiVsEmi,
} from '../../utils/cardBilling';
import Icon from 'react-native-vector-icons/Ionicons';

function sortTxnDesc<A extends { date: unknown }>(a: A, b: A): number {
  const tb = typeof b.date === 'number' ? b.date : new Date(b.date as any).getTime();
  const ta = typeof a.date === 'number' ? a.date : new Date(a.date as any).getTime();
  return tb - ta;
}

const AccountTransactionsScreen: React.FC = observer(({ route }: any) => {
  const { budget, accounts, loans } = useStores();
  const [emiRepayOpen, setEmiRepayOpen] = useState(false);
  const accountId = route.params?.accountId as string | undefined;

  const account = accounts.accounts.find(a => a.id === accountId);

  const refresh = useCallback(() => {
    budget.load();
    accounts.load();
    loans.load();
  }, [budget, accounts, loans]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return undefined;
    }, [refresh]),
  );

  const rows =
    accountId == null
      ? []
      : [...budget.transactions]
          .filter(t => t.accountId === accountId)
          .sort((a, b) => {
            const tb = typeof b.date === 'number' ? b.date : new Date(b.date).getTime();
            const ta = typeof a.date === 'number' ? a.date : new Date(a.date).getTime();
            return tb - ta;
          });

  const totalOut = rows.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIn = rows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const linkedLoans = accountId ? loans.loans.filter(l => l.accountId === accountId) : [];
  const creditCycle =
    account && account.type === 'credit'
      ? (() => {
          const cs = accounts.getStatementCycleStart(account);
          const csMs = cs.getTime();
          return computeCreditCardOutstandingThisCycle(
            csMs,
            rows.map(t => ({
              amount: t.amount,
              date: t.date as any,
              subCategory: t.subCategory,
            })),
            linkedLoans.map(l => ({
              principal: l.principal,
              roi: l.roi,
              tenureMonths: l.tenureMonths,
              paidEmis: l.paidEmis,
            })),
          );
        })()
      : null;

  const limit = account?.type === 'credit' ? (account.creditLimit ?? 0) : 0;
  const utilPct =
    account?.type === 'credit' && limit > 0 ? (account.currentBalance / limit) * 100 : 0;
  const headroom = Math.max(0, limit - (account?.currentBalance ?? 0));
  const utilColor = creditUtilizationColor(utilPct);

  if (!account) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Account not found.</Text>
      </View>
    );
  }

  const owedSplit =
    account.type === 'credit' && creditCycle
      ? splitOutstandingNonEmiVsEmi({
          nonEmiCycleNet: creditCycle.nonEmiCycleNet,
          remainingEmiLiabilityTotal: creditCycle.remainingEmiLiabilityTotal,
        })
      : null;

  const emiDebitRows =
    account.type === 'credit'
      ? rows.filter(t => t.amount < 0 && isLoanEmiSubCategory(t.subCategory)).sort(sortTxnDesc)
      : [];

  const otherTxnRows =
    account.type === 'credit'
      ? rows.filter(t => !(t.amount < 0 && isLoanEmiSubCategory(t.subCategory))).sort(sortTxnDesc)
      : [...rows].sort(sortTxnDesc);

  const emiDebitSumLogged = emiDebitRows.reduce((s, t) => s + Math.abs(t.amount), 0);

  const title =
    account.type === 'credit'
      ? `${account.bankName} ···${account.cardLast2 ?? '—'}`
      : account.name;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={budget.loading} onRefresh={refresh} tintColor={Colors.primary} />
        }
      >
        <SectionHeader title={title} />
        <Text style={styles.screenHint}>
          {account.type === 'credit'
            ? 'Usage = remaining loan EMI total on this card + non‑EMI this cycle (green + EMI lines are bookkeeping only — liability stays in EMI total until loans finish).'
            : 'Newest transactions first.'}
        </Text>

        {account.type === 'credit' && creditCycle && owedSplit && (
          <Card style={styles.summaryCard}>
            <Text style={styles.kpiBig}>₹{formatINR(account.currentBalance)} owed</Text>
            <Text style={styles.kpiLineMuted}>
              From {accounts.getStatementCycleStart(account).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
              })}
              {' · '}Non‑EMI this cycle ₹{formatINR(creditCycle.nonEmiCycleNet)}
            </Text>
            <View style={styles.splitRow}>
              <Text style={styles.splitItem}>
                Non‑EMI (cycle) ₹<Text style={styles.splitAmt}>{formatINR(owedSplit.nonEmiOutstanding)}</Text>
              </Text>
              <Text style={styles.splitGap}>│</Text>
              <Text style={styles.splitItem}>
                Remaining EMI (all dues) ₹<Text style={styles.splitAmt}>{formatINR(owedSplit.emiOutstanding)}</Text>
              </Text>
            </View>
            {limit > 0 ? (
              <>
                <ProgressBar pct={Math.min(100, utilPct)} color={utilColor} height={8} style={{ marginTop: Spacing.sm }} />
                <Text style={styles.kpiLineMuted}>
                  {utilPct.toFixed(0)}% of limit · Left ₹{formatINR(headroom)} / ₹{formatINR(limit)}
                </Text>
              </>
            ) : (
              <Text style={styles.kpiLineMuted}>Add a credit limit under Accounts → Edit.</Text>
            )}
          </Card>
        )}

        {(totalOut > 0 || totalIn > 0) && (
          <Card style={styles.summaryCard}>
            <Text style={styles.breakdownHead}>Lifetime on this ledger</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Out</Text>
              <Text style={[styles.summaryValue, { color: Colors.danger }]}>₹{formatINR(totalOut)}</Text>
            </View>
            {totalIn > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>In</Text>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>₹{formatINR(totalIn)}</Text>
              </View>
            )}
          </Card>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No transactions yet"
            description="Spends and payments logged against this account in Budget will show here."
          />
        ) : (
          <>
            {account.type === 'credit' && emiDebitRows.length > 0 && (
              <Card style={styles.groupCard}>
                <TouchableOpacity
                  style={styles.groupHeader}
                  activeOpacity={0.7}
                  onPress={() => setEmiRepayOpen(o => !o)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>Loan EMI repayments</Text>
                    <Text style={styles.groupSub}>
                      {emiDebitRows.length} · ₹{formatINR(emiDebitSumLogged)} on ledger · Tap to {emiRepayOpen ? 'hide' : 'show'}
                    </Text>
                  </View>
                  <Icon name={emiRepayOpen ? 'chevron-up' : 'chevron-forward'} size={22} color={Colors.textMuted} />
                </TouchableOpacity>
                {emiRepayOpen &&
                  emiDebitRows.map(t => {
                    const d = new Date(t.date as any);
                    const amt = Math.abs(t.amount);
                    return (
                      <View key={t.id} style={styles.groupItem}>
                        <Divider style={{ marginVertical: Spacing.sm }} />
                        <View style={styles.rowTop}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.rowTitle}>{t.subCategory}</Text>
                              <Badge label="EMI" color={Colors.success} bgColor={`${Colors.success}22`} />
                            </View>
                            <Text style={styles.rowMeta}>
                              {t.category}
                              {t.isJointExpense ? ' · Joint' : ''}
                            </Text>
                            {!!t.note && <Text style={styles.rowNote}>{t.note}</Text>}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.rowAmt, { color: Colors.success }]}>+₹{formatINR(amt)}</Text>
                            <Text style={styles.rowFlow}>Instalment (paydown)</Text>
                          </View>
                        </View>
                        <Text style={styles.rowDate}>
                          {d.toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                    );
                  })}
              </Card>
            )}

            {otherTxnRows.map(t => {
              const d = new Date(t.date as any);
              const isOut = t.amount < 0;
              const amt = Math.abs(t.amount);
              const isBillPay =
                account.type === 'credit' && isCreditCardBillPaymentSubCategory(t.subCategory);
              return (
                <Card key={t.id} style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.rowTitle}>{t.subCategory}</Text>
                        {isBillPay && (
                          <Badge label="BILL" color={Colors.info} bgColor={`${Colors.info}22`} />
                        )}
                      </View>
                      <Text style={styles.rowMeta}>
                        {t.category}
                        {t.isJointExpense ? ' · Joint' : ''}
                      </Text>
                      {!!t.note && <Text style={styles.rowNote}>{t.note}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.rowAmt, { color: isBillPay ? Colors.info : isOut ? Colors.danger : Colors.success }]}>
                        {isOut ? '−' : '+'}₹{formatINR(amt)}
                      </Text>
                      {account.type === 'credit' && (
                        <Text style={styles.rowFlow}>
                          {isBillPay ? 'Bill paid' : isOut ? 'Spend' : 'Credit'}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Divider style={{ marginVertical: Spacing.sm }} />
                  <Text style={styles.rowDate}>
                    {d.toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </Card>
              );
            })}
          </>
        )}
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </>
  );
});

export default AccountTransactionsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingTop: Spacing.sm, paddingHorizontal: Spacing.base },
  screenHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    marginTop: -4,
    lineHeight: 18,
    paddingHorizontal: 2,
  },
  fallback: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: Colors.textSecondary, fontSize: FontSize.base },
  summaryCard: { marginBottom: Spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  summaryLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  summaryValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  rowCard: { marginBottom: Spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  rowTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  rowMeta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  rowNote: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 6, fontStyle: 'italic' },
  rowAmt: { fontSize: FontSize.md, fontWeight: FontWeight.black },
  rowDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  kpiBig: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.black,
    color: Colors.textPrimary,
  },
  kpiLineMuted: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 6, lineHeight: 17 },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  splitItem: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  splitAmt: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
  splitGap: { color: Colors.textMuted, paddingHorizontal: 4 },
  groupCard: {
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  groupTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  groupSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  groupItem: { paddingBottom: Spacing.sm },
  breakdownHead: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  rowFlow: { fontSize: 10, color: Colors.textMuted, marginTop: 4, maxWidth: 120, textAlign: 'right' },
});
