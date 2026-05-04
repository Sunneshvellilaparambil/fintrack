import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, StatusBar,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../theme';
import { Card, GlowCard, SectionHeader, Badge, Divider, EmptyState } from '../../components/shared';
import { formatINR, creditUtilizationColor } from '../../utils/finance';
import { computeCreditCardOutstandingThisCycle } from '../../utils/cardBilling';
import { Account } from '../../db/models';

const BillsScreen: React.FC = observer(() => {
  const { accounts, budget, loans } = useStores();
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [hasCheckedOverdue, setHasCheckedOverdue] = useState(false);
  const [payModal, setPayModal] = useState<{
    card: Account;
    totalBill: number;
  } | null>(null);
  const [payFromId, setPayFromId] = useState('');
  const [payAmountStr, setPayAmountStr] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  const today = new Date();

  const bills = accounts.creditCards
    .filter(c => c.billDate && c.dueDate)
    .map(card => {
      const cycleStart = accounts.getCycleStart(card.billDate as number);
      const nextBill = accounts.getNextBillDate(card.billDate as number);
      const nextDue = accounts.getNextDueDate(card.billDate as number, card.dueDate as number);

      const cardTxnsAll = budget.transactions.filter(t => t.accountId === card.id);
      const cardLoans = loans.loans.filter(l => l.accountId === card.id);
      const breakdown = computeCreditCardOutstandingThisCycle(
        cycleStart.getTime(),
        cardTxnsAll,
        cardLoans.map(l => ({
          principal: l.principal,
          roi: l.roi,
          tenureMonths: l.tenureMonths,
          paidEmis: l.paidEmis,
        })),
      );

      const totalBill = (breakdown as any).cycleStatementDue;
      const monthlyEmisOnCard = breakdown.monthlyEmiCommitted;

      // Math Truth: Paid if the current cycle due is 0. 
      // If you spend more after paying, it becomes unpaid again.
      const isPaid = totalBill <= 1; // 1 rupee buffer for rounding

      const daysUntilDue = Math.ceil((nextDue.getTime() - today.getTime()) / 86400000);
      const isOverdue = !isPaid && daysUntilDue < 0;

      return {
        card,
        cycleStart,
        nextBill,
        nextDue,
        totalBill,
        isPaid,
        isOverdue,
        daysUntilDue,
        breakdown,
        monthlyEmisOnCard,
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const overdueBills = bills.filter(b => b.isOverdue && b.totalBill > 0);

  const openPayBill = (card: Account, totalBill: number) => {
    setPayModal({ card, totalBill });
    setPayFromId(accounts.debitAccounts[0]?.id ?? '');
    setPayAmountStr(totalBill > 0 ? String(totalBill) : '');
    setPaySubmitting(false);
  };

  const handleSubmitBillPayment = async () => {
    if (!payModal) return;
    const amt = parseFloat(String(payAmountStr).replace(/,/g, '').trim());
    if (!payFromId || !Number.isFinite(amt) || amt <= 0) {
      Alert.alert('Check details', 'Choose the account you paid from and enter a valid amount.');
      return;
    }
    const debit = accounts.debitAccounts.find(d => d.id === payFromId);
    if (!debit) {
      Alert.alert('Invalid account', 'Pick a debit account to pay from.');
      return;
    }
    if (debit.currentBalance + 1e-6 < amt) {
      Alert.alert(
        'Insufficient balance',
        `${debit.name} has ₹${formatINR(debit.currentBalance)}. Lower the amount or add funds.`,
      );
      return;
    }
    const cardLabel = `${payModal.card.bankName} ···${payModal.card.cardLast2 ?? ''}`;
    setPaySubmitting(true);
    try {
      await budget.payCreditCardBill({
        creditCardAccountId: payModal.card.id,
        fromDebitAccountId: payFromId,
        amount: amt,
        cardLabel,
        debitAccountName: debit.name,
      });
      await accounts.load();

      const settlesCycle = payModal.totalBill <= 0 ? true : amt >= payModal.totalBill - 0.01;
      if (settlesCycle) {
        await accounts.markBillCycleSettled(payModal.card.id);
      } else {
        await accounts.recalculateCardBalance(payModal.card.id);
      }

      setPayModal(null);
      Alert.alert(
        'Recorded',
        settlesCycle
          ? 'Payment saved. Debit balance reduced and card usage updated.'
          : 'Partial payment saved. Pay the rest when ready; this cycle stays open until settled in full.',
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not record payment.');
    } finally {
      setPaySubmitting(false);
    }
  };

  useEffect(() => {
    if (!hasCheckedOverdue && overdueBills.length > 0) {
      setShowOverdueModal(true);
      setHasCheckedOverdue(true);
    }
  }, [hasCheckedOverdue, overdueBills.length]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <GlowCard glowColor={Colors.warning}>
          <Text style={styles.heroLabel}>UPCOMING BILLS</Text>
          <Text style={[styles.heroValue, { color: Colors.warning }]}>
            {bills.filter(b => !b.isPaid).length} Cards
          </Text>
          <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>
            ₹{formatINR(bills.filter(b => !b.isPaid).reduce((s, b) => s + b.totalBill, 0))} Total Due
          </Text>
        </GlowCard>

        <SectionHeader title="Credit Card Bills" />

        {bills.length === 0 ? (
          <EmptyState icon="receipt-outline" title="No bills generated" description="Add credit cards with Bill & Due days to see your bills." />
        ) : (
          bills.map(({ card, cycleStart, nextBill, nextDue, totalBill, isPaid, isOverdue, daysUntilDue, breakdown, monthlyEmisOnCard }) => {
            const urgentColor = isPaid ? Colors.success : (isOverdue ? Colors.danger : (daysUntilDue <= 5 ? Colors.warning : Colors.info));
            const formatD = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

            return (
              <Card key={card.id} style={StyleSheet.flatten([styles.billCard, { borderLeftColor: urgentColor, borderLeftWidth: 4, opacity: isPaid ? 0.6 : 1 }])}>
                <View style={styles.billHeaderRow}>
                  <View style={styles.billCardLeft}>
                    <Text style={[styles.billCardTitle, isPaid && { textDecorationLine: 'line-through', color: Colors.textMuted }]}>
                      {card.bankName} ···{card.cardLast2}
                    </Text>
                    <Text style={styles.billCycleLabel}>
                      Cycle: {formatD(cycleStart)} → {formatD(nextBill)}
                    </Text>
                    <Text style={[styles.billCycleLabel, { color: urgentColor, fontWeight: FontWeight.bold }]}>
                      Due on {formatD(nextDue)}
                    </Text>
                  </View>
                  <View style={styles.billCardRight}>
                    <Text style={[styles.billDaysLeft, { color: urgentColor }]}>
                      {isPaid ? 'PAID ✅' : (isOverdue ? `${Math.abs(daysUntilDue)}d Overdue` : (daysUntilDue === 0 ? 'Due Today' : `in ${daysUntilDue}d`))}
                    </Text>
                    <Text style={styles.billTotal}>₹{formatINR(totalBill)}</Text>
                  </View>
                </View>

                {(breakdown.nonEmiCycleNet > 0 ||
                  breakdown.remainingEmiLiabilityTotal > 0 ||
                  monthlyEmisOnCard > 0) && (
                    <View style={{ marginTop: 8, gap: 2 }}>
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                        Monthly Spends: ₹{formatINR(breakdown.nonEmiCycleNet)} · Monthly EMIs: ₹{formatINR(monthlyEmisOnCard)}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.textSecondary, fontWeight: FontWeight.semibold }}>
                        Total Card Debt (inc. future EMIs): ₹{formatINR(breakdown.outstanding)}
                      </Text>
                    </View>
                  )}

                {!isPaid && totalBill > 0 && (
                  <TouchableOpacity
                    style={styles.payBtn}
                    activeOpacity={0.8}
                    onPress={() => openPayBill(card, totalBill)}
                  >
                    <Text style={styles.payBtnText}>Pay bill</Text>
                  </TouchableOpacity>
                )}
                {isPaid && (
                  <View style={styles.paidBadge}>
                    <Text style={styles.paidBadgeText}>✓ Settled for this cycle</Text>
                  </View>
                )}
              </Card>
            );
          })
        )}
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Pay credit card bill */}
      <Modal visible={!!payModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.paySheet}>
          <View style={styles.paySheetHeader}>
            <Text style={styles.paySheetTitle}>Pay credit card bill</Text>
            <TouchableOpacity
              style={styles.paySheetClose}
              onPress={() => !paySubmitting && setPayModal(null)}
            >
              <Text style={styles.paySheetCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {payModal && (
            <ScrollView style={styles.paySheetBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.payHint}>
                Debit your bank account and book a matching credit on {payModal.card.bankName} ···{payModal.card.cardLast2}.
                Card usage (purchases + EMI) drops by the amount you pay.
              </Text>
              <Text style={styles.payLabel}>Amount due (edit for partial pay)</Text>
              <TextInput
                style={styles.payInput}
                value={payAmountStr}
                onChangeText={setPayAmountStr}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.payLabel}>Pay from</Text>
              {accounts.debitAccounts.length === 0 ? (
                <Text style={styles.payNoDebit}>Add a debit account under Accounts to pay bills.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.payChips}>
                  {accounts.debitAccounts.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.payChip, payFromId === a.id && styles.payChipOn]}
                      onPress={() => setPayFromId(a.id)}
                    >
                      <Text style={[styles.payChipLabel, payFromId === a.id && styles.payChipLabelOn]}>{a.name}</Text>
                      <Text style={styles.payChipBal}>₹{formatINR(a.currentBalance)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[styles.payConfirm, (paySubmitting || accounts.debitAccounts.length === 0) && { opacity: 0.5 }]}
                disabled={paySubmitting || accounts.debitAccounts.length === 0}
                onPress={handleSubmitBillPayment}
              >
                {paySubmitting ? (
                  <ActivityIndicator color={Colors.textPrimary} />
                ) : (
                  <Text style={styles.payConfirmTxt}>Record payment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Overdue Modal */}
      <Modal visible={showOverdueModal} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 8 }}>⚠️</Text>
            <Text style={styles.modalTitle}>Overdue Bills Detected</Text>
            <Text style={styles.modalSub}>
              You have {overdueBills.length} credit card bill(s) that have passed their due date.
            </Text>

            <ScrollView style={{ maxHeight: 250, marginVertical: Spacing.base }}>
              {overdueBills.map(b => (
                <View key={b.card.id} style={styles.overdueRow}>
                  <View>
                    <Text style={{ color: Colors.textPrimary, fontWeight: 'bold' }}>{b.card.bankName} ···{b.card.cardLast2}</Text>
                    <Text style={{ color: Colors.danger, fontSize: FontSize.xs }}>{Math.abs(b.daysUntilDue)} days overdue</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: Colors.textPrimary, fontWeight: 'bold' }}>₹{formatINR(b.totalBill)}</Text>
                    <TouchableOpacity onPress={() => openPayBill(b.card, b.totalBill)} style={{ padding: 4, backgroundColor: Colors.successDim, borderRadius: 4, marginTop: 4 }}>
                      <Text style={{ color: Colors.success, fontSize: FontSize.xs, fontWeight: 'bold' }}>Pay bill</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowOverdueModal(false)}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
});

export default BillsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingTop: Spacing.lg },
  heroLabel: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.bold, letterSpacing: 1.2 },
  heroValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, marginTop: 4, marginBottom: 2 },
  billCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm, backgroundColor: Colors.bgCard },
  billHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  billCardLeft: { flex: 1 },
  billCardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  billCycleLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  billCardRight: { alignItems: 'flex-end' },
  billDaysLeft: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  billTotal: { fontSize: FontSize.lg, fontWeight: FontWeight.black, color: Colors.textPrimary, marginTop: 4 },
  payBtn: { marginTop: Spacing.base, backgroundColor: Colors.successDim, paddingVertical: 8, borderRadius: Radius.sm, alignItems: 'center' },
  payBtnText: { color: Colors.success, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  paidBadge: { marginTop: Spacing.base, paddingVertical: 8, backgroundColor: Colors.bgElevated, borderRadius: Radius.sm, alignItems: 'center' },
  paidBadgeText: { color: Colors.success, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.danger, textAlign: 'center' },
  modalSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
  overdueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  closeModalBtn: { backgroundColor: Colors.bgElevated, padding: Spacing.base, borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.base },
  closeModalText: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  paySheet: { flex: 1, backgroundColor: Colors.bg },
  paySheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingTop: Spacing.lg,
  },
  paySheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  paySheetClose: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  paySheetCloseTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  paySheetBody: { padding: Spacing.base },
  payHint: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.base },
  payLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.base, marginBottom: Spacing.xs, fontWeight: FontWeight.semibold },
  payInput: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.base, color: Colors.textPrimary, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border,
  },
  payNoDebit: { fontSize: FontSize.sm, color: Colors.warning, marginTop: 4 },
  payChips: { marginTop: 4, maxHeight: 100 },
  payChip: {
    marginRight: Spacing.sm, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bgCard, minWidth: 120,
  },
  payChipOn: { borderColor: Colors.info, backgroundColor: `${Colors.info}18` },
  payChipLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  payChipLabelOn: { color: Colors.textPrimary },
  payChipBal: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  payConfirm: {
    backgroundColor: Colors.success, borderRadius: Radius.md, padding: Spacing.base,
    alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.xxl,
  },
  payConfirmTxt: { color: Colors.textPrimary, fontWeight: FontWeight.black, fontSize: FontSize.base },
});
