import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, StatusBar } from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../theme';
import { Card, GlowCard, SectionHeader, Badge, Divider, EmptyState } from '../../components/shared';
import { formatINR, creditUtilizationColor, calculateEMI } from '../../utils/finance';

const BillsScreen: React.FC = observer(() => {
  const { accounts, budget, loans } = useStores();
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [hasCheckedOverdue, setHasCheckedOverdue] = useState(false);

  const today = new Date();

  const bills = accounts.creditCards
    .filter(c => c.billDate && c.dueDate)
    .map(card => {
      const cycleStart = accounts.getCycleStart(card.billDate as number);
      const nextBill = accounts.getNextBillDate(card.billDate as number);
      const nextDue = accounts.getNextDueDate(card.billDate as number, card.dueDate as number);
      
      const cycleSpends = budget.transactions.filter(t =>
        t.accountId === card.id &&
        new Date(t.date).getTime() >= cycleStart.getTime()
      );
      
      // Expenses are negative (add to bill), Payments are positive (reduce bill)
      const cyclePurchases = cycleSpends.reduce((s, t) => s - t.amount, 0);
      
      // Calculate EMIs for loans linked to this card
      const cardLoans = loans.loans.filter(l => l.accountId === card.id);
      const cycleEMIs = cardLoans.reduce((s, l) => s + calculateEMI(l.principal, l.roi, l.tenureMonths), 0);
      
      const totalBill = Math.max(0, cyclePurchases + cycleEMIs);
      
      // Check if paid
      const isPaid = card.lastPaidCycleStart && new Date(card.lastPaidCycleStart).getTime() >= cycleStart.getTime();
      
      const daysUntilDue = Math.ceil((nextDue.getTime() - today.getTime()) / 86400000);
      const isOverdue = !isPaid && daysUntilDue < 0;

      return { card, cycleStart, nextBill, nextDue, totalBill, isPaid, isOverdue, daysUntilDue, cyclePurchases, cycleEMIs };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const overdueBills = bills.filter(b => b.isOverdue && b.totalBill > 0);

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
          <EmptyState icon="🧾" title="No bills generated" description="Add credit cards with Bill & Due days to see your bills." />
        ) : (
          bills.map(({ card, cycleStart, nextBill, nextDue, totalBill, isPaid, isOverdue, daysUntilDue, cycleEMIs }) => {
            const urgentColor = isPaid ? Colors.success : (isOverdue ? Colors.danger : (daysUntilDue <= 5 ? Colors.warning : Colors.info));
            const formatD = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

            return (
              <Card key={card.id} style={StyleSheet.flatten([styles.billCard, { borderLeftColor: urgentColor, borderLeftWidth: 4, opacity: isPaid ? 0.6 : 1 }])}>
                <View style={styles.billHeaderRow}>
                  <View style={styles.billCardLeft}>
                    <Text style={[styles.billCardTitle, isPaid && { textDecorationLine: 'line-through', color: Colors.textMuted }]}>
                      💳 {card.bankName} ···{card.cardLast2}
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

                {cycleEMIs > 0 && (
                  <Text style={{ fontSize: FontSize.xs, color: Colors.warning, marginTop: 4 }}>
                    Includes ₹{formatINR(cycleEMIs)} from active EMIs
                  </Text>
                )}

                {!isPaid && totalBill > 0 && (
                  <TouchableOpacity
                    style={styles.payBtn}
                    activeOpacity={0.8}
                    onPress={() => accounts.markBillAsPaid(card.id)}
                  >
                    <Text style={styles.payBtnText}>Mark as Paid</Text>
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
                    <TouchableOpacity onPress={() => accounts.markBillAsPaid(b.card.id)} style={{ padding: 4, backgroundColor: Colors.successDim, borderRadius: 4, marginTop: 4 }}>
                      <Text style={{ color: Colors.success, fontSize: FontSize.xs, fontWeight: 'bold' }}>Mark Paid</Text>
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
});
