import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../theme';
import { Card, SectionHeader, EmptyState, ProgressBar } from '../../components/shared';
import { formatINR } from '../../utils/finance';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const RDScreen: React.FC = observer(() => {
  const { wealth, accounts } = useStores();
  const [payModal, setPayModal] = useState<any>(null);
  const navigation = useNavigation<any>();

  const handlePay = async () => {
    if (!payModal) return;
    if (!payModal.selectedAccount) {
      Alert.alert('Error', 'Please select an account to pay from');
      return;
    }

    const debitAccount = accounts.accounts.find(a => a.id === payModal.selectedAccount);
    if (!debitAccount || debitAccount.currentBalance < payModal.rd.monthlyInstallment) {
      Alert.alert('Insufficient Balance', 'The selected account does not have enough balance.');
      return;
    }

    try {
      await wealth.payRDInstallment(
        payModal.rd.id,
        payModal.selectedAccount,
        payModal.rd.monthlyInstallment
      );
      setPayModal(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <SectionHeader 
          title="Recurring Deposits" 
          action={
            <TouchableOpacity 
              style={{ backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full }}
              onPress={() => navigation.navigate('Wealth')}
            >
              <Text style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: 'bold' }}>+ Add RD</Text>
            </TouchableOpacity>
          }
        />

        {wealth.rds.length === 0 ? (
          <EmptyState
            icon="business-outline"
            title="No RDs"
            description="You don't have any recurring deposits yet. Add them in the Wealth section."
          />
        ) : (
          wealth.rds.map(rd => {
            const isCompleted = rd.paidInstallments >= rd.durationMonths;
            const progressPct = (rd.paidInstallments / rd.durationMonths) * 100;
            const totalInvested = rd.paidInstallments * rd.monthlyInstallment;

            // Determine if due based on day of month, but let's just make it payable always unless completed
            return (
              <Card key={rd.id} style={styles.rdCard}>
                <View style={styles.rdHeader}>
                  <View style={styles.iconBox}>
                    <Icon name="business" size={24} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={styles.rdName}>{rd.name}</Text>
                    <Text style={styles.rdSub}>
                      {rd.durationMonths - rd.paidInstallments} months left • {rd.roi}% ROI
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.rdAmount}>₹{formatINR(rd.monthlyInstallment, true)}</Text>
                    <Text style={styles.rdSub}>per month</Text>
                  </View>
                </View>

                <View style={{ marginVertical: Spacing.base }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary }}>
                      {rd.paidInstallments} / {rd.durationMonths} Paid
                    </Text>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary }}>
                      Invested: ₹{formatINR(totalInvested, true)}
                    </Text>
                  </View>
                  <ProgressBar pct={progressPct} color={isCompleted ? Colors.success : Colors.primary} height={8} />
                </View>

                <View style={styles.actions}>
                  {isCompleted ? (
                    <View style={styles.paidBadge}>
                      <Icon name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.paidText}>Completed</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.payBtn}
                      onPress={() => {
                        setPayModal({
                          rd,
                          selectedAccount: rd.accountId || (accounts.debitAccounts[0]?.id || '')
                        });
                      }}
                    >
                      <Text style={styles.payBtnText}>Pay Installment</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* ── Payment Modal ────────────────────────────────────────────── */}
      <Modal visible={!!payModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setPayModal(null)} />
          {payModal && (
            <View style={styles.paySheetBody}>
              <View style={styles.billSummaryCard}>
                <View style={styles.billSummaryTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.billSummaryCardName}>
                      <Icon name="business" size={16} color={Colors.textPrimary} /> {payModal.rd.name}
                    </Text>
                    <Text style={styles.billSummaryCycle}>
                      Deposit Day: {payModal.rd.depositDay}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.billSummaryAmount}>₹{formatINR(payModal.rd.monthlyInstallment)}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sheetSectionTitle}>Pay From Account</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountScroller}>
                {accounts.debitAccounts.map(acc => {
                  const isSelected = payModal.selectedAccount === acc.id;
                  const insufficient = acc.currentBalance < payModal.rd.monthlyInstallment;

                  return (
                    <TouchableOpacity
                      key={acc.id}
                      style={[
                        styles.accountCard,
                        isSelected && styles.accountCardActive,
                        insufficient && { opacity: 0.5 },
                      ]}
                      onPress={() => setPayModal((p: any) => ({ ...p, selectedAccount: acc.id }))}
                      disabled={insufficient}
                    >
                      <View style={styles.accountCardHeader}>
                        <Text style={styles.accountCardName}>{acc.bankName}</Text>
                        <View style={[styles.radio, isSelected && styles.radioActive]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                      </View>
                      <Text style={styles.accountCardBal}>Bal: ₹{formatINR(acc.currentBalance)}</Text>
                      {insufficient && <Text style={{ fontSize: 10, color: Colors.danger, marginTop: 4 }}>Insufficient</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.confirmBtn, !payModal.selectedAccount && { opacity: 0.5 }]}
                onPress={handlePay}
                disabled={!payModal.selectedAccount}
              >
                <Text style={styles.confirmBtnText}>Pay ₹{formatINR(payModal.rd.monthlyInstallment)}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
});

export default RDScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xxl },
  rdCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.base, padding: Spacing.base },
  rdHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 48, height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryGlow,
    alignItems: 'center', justifyContent: 'center'
  },
  rdName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rdSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  rdAmount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.xs },
  payBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.full
  },
  payBtnText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  paidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.successDim,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.full
  },
  paidText: { color: Colors.success, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  paySheetBody: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl + 20,
  },
  billSummaryCard: {
    backgroundColor: Colors.bgElevated, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.lg,
  },
  billSummaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billSummaryCardName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  billSummaryCycle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  billSummaryAmount: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.danger },
  sheetSectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.base },
  accountScroller: { marginBottom: Spacing.xl },
  accountCard: {
    width: 140, padding: Spacing.base, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.bg, marginRight: Spacing.base,
  },
  accountCardActive: { borderColor: Colors.info, backgroundColor: `${Colors.info}18` },
  accountCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  accountCardName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  accountCardBal: { fontSize: FontSize.xs, color: Colors.textSecondary },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.textMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.info },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.info },
  confirmBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.base, alignItems: 'center',
  },
  confirmBtnText: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
