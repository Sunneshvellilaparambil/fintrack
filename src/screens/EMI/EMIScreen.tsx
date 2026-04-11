import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, StatusBar,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../theme';
import { Card, GlowCard, Badge, SectionHeader, EmptyState, Divider, MetricTile, StatRow } from '../../components/shared';
import { formatINR, calculateEMI, generateAmortization, calculateTaxBenefits } from '../../utils/finance';

type LoanType = 'housing' | 'vehicle' | 'personal';

const LOAN_COLORS: Record<LoanType, string> = {
  housing: Colors.info,
  vehicle: Colors.warning,
  personal: Colors.danger,
};

const LOAN_EMOJIS: Record<LoanType, string> = {
  housing: '🏠',
  vehicle: '🚗',
  personal: '👤',
};

const EMIScreen: React.FC = observer(() => {
  const { loans } = useStores();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);
  const [showAmort, setShowAmort] = useState(false);
  const [form, setForm] = useState({
    type: 'housing' as LoanType, lender: '', principal: '',
    roi: '', tenureMonths: '', emiDay: '5',
    startDate: new Date().toISOString().split('T')[0],
  });

  const handleAdd = async () => {
    if (!form.lender || !form.principal || !form.roi || !form.tenureMonths) {
      Alert.alert('Error', 'Please fill in all required fields.'); return;
    }
    await loans.addLoan({
      type: form.type,
      lender: form.lender,
      principal: parseFloat(form.principal),
      roi: parseFloat(form.roi),
      tenureMonths: parseInt(form.tenureMonths),
      startDate: new Date(form.startDate),
      emiDay: parseInt(form.emiDay),
    });
    setShowAddModal(false);
  };

  const selected = selectedLoan ? loans.loans.find(l => l.id === selectedLoan) : null;
  const amortSchedule = selected ? generateAmortization(selected.principal, selected.roi, selected.tenureMonths) : [];
  const taxBenefits = selected && selected.type === 'housing'
    ? calculateTaxBenefits(selected.principal, selected.roi, selected.tenureMonths, selected.paidEmis)
    : null;

  const today = new Date();
  const daysUntilEMI = (emiDay: number) => {
    const nextDue = new Date(today.getFullYear(), today.getMonth(), emiDay);
    if (nextDue <= today) nextDue.setMonth(nextDue.getMonth() + 1);
    return Math.ceil((nextDue.getTime() - today.getTime()) / 86400000);
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ──────────────────────────────────────────── */}
        <GlowCard glowColor={Colors.warning}>
          <MetricTile
            label="Total Monthly EMI Outflow"
            value={`₹${formatINR(loans.totalMonthlyEMI)}`}
            sub={`${loans.loans.length} active loan${loans.loans.length !== 1 ? 's' : ''}`}
            color={Colors.warning}
          />
        </GlowCard>

        {/* ── EMI Calendar ─────────────────────────────────── */}
        <SectionHeader
          title="EMI Calendar"
          action={
            <TouchableOpacity
              style={styles.addLoanBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addLoanBtnText}>+ Add Loan</Text>
            </TouchableOpacity>
          }
        />

        {loans.loans.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No loans added"
            description="Add your loans to track EMI dues and amortization"
          />
        ) : (
          loans.loans.map(loan => {
            const type = loan.type as LoanType;
            const color = LOAN_COLORS[type] ?? Colors.primary;
            const emoji = LOAN_EMOJIS[type] ?? '💰';
            const emi = calculateEMI(loan.principal, loan.roi, loan.tenureMonths);
            const remaining = loan.tenureMonths - loan.paidEmis;
            const days = daysUntilEMI(loan.emiDay);
            const isUrgent = days <= 5;
            const progressPct = (loan.paidEmis / loan.tenureMonths) * 100;

            return (
              <TouchableOpacity
                key={loan.id}
                activeOpacity={0.75}
                onPress={() => { setSelectedLoan(loan.id); setShowAmort(true); }}
              >
                <Card style={[styles.loanCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
                  {/* Top row */}
                  <View style={styles.loanTop}>
                    <View style={[styles.loanIconBg, { backgroundColor: `${color}18` }]}>
                      <Text style={styles.loanEmoji}>{emoji}</Text>
                    </View>
                    <View style={styles.loanInfo}>
                      <Text style={styles.loanLender}>{loan.lender}</Text>
                      <Badge label={loan.type.toUpperCase()} color={color} bgColor={`${color}18`} />
                    </View>
                    <View style={styles.loanRight}>
                      <Text style={[styles.loanEMI, { color }]}>₹{formatINR(emi)}/mo</Text>
                      <Text style={[styles.loanDue, {
                        color: isUrgent ? Colors.danger : Colors.textMuted,
                      }]}>
                        {isUrgent ? '🔴 ' : ''}Due in {days}d
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.loanProgressRow}>
                    <Text style={styles.loanProgressLabel}>
                      {loan.paidEmis}/{loan.tenureMonths} EMIs paid
                    </Text>
                    <Text style={styles.loanProgressPct}>{progressPct.toFixed(0)}%</Text>
                  </View>
                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progressPct}%`, backgroundColor: color },
                      ]}
                    />
                  </View>

                  {/* Stats */}
                  <StatRow
                    items={[
                      { label: 'Principal', value: `₹${formatINR(loan.principal, true)}` },
                      { label: 'Rate', value: `${loan.roi}% p.a.` },
                      { label: 'Remaining', value: `${remaining} EMIs`, color },
                    ]}
                  />

                  {/* Pay button */}
                  <TouchableOpacity
                    style={styles.payBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                      Alert.alert('Mark EMI Paid', `Mark ₹${formatINR(emi)} as paid?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Confirm', onPress: () => loans.markEMIPaid(loan.id) },
                      ]);
                    }}
                  >
                    <Text style={styles.payBtnText}>✓  Mark This Month Paid</Text>
                  </TouchableOpacity>
                </Card>
              </TouchableOpacity>
            );
          })
        )}

        {/* ── Add Loan Modal ─────────────────────────────── */}
        <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Loan / EMI</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ padding: Spacing.base }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.inputLabel}>Loan Type</Text>
              <View style={styles.typeRow}>
                {(['housing', 'vehicle', 'personal'] as LoanType[]).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, form.type === t && [
                      styles.typeBtnActive, { borderColor: LOAN_COLORS[t] }
                    ]]}
                    onPress={() => setForm(f => ({ ...f, type: t }))}
                  >
                    <Text style={styles.typeBtnEmoji}>{LOAN_EMOJIS[t]}</Text>
                    <Text style={[styles.typeBtnText, form.type === t && styles.typeBtnTextActive]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {[
                { label: 'Lender / Bank *', key: 'lender', placeholder: 'e.g. SBI Home Loan' },
                { label: 'Principal Amount (₹) *', key: 'principal', placeholder: 'e.g. 5000000', keyboard: 'decimal-pad' },
                { label: 'Annual Interest Rate (%) *', key: 'roi', placeholder: 'e.g. 8.5', keyboard: 'decimal-pad' },
                { label: 'Tenure (months) *', key: 'tenureMonths', placeholder: 'e.g. 240', keyboard: 'numeric' },
                { label: 'EMI Due Day of Month', key: 'emiDay', placeholder: '1–28', keyboard: 'numeric' },
                { label: 'Start Date (YYYY-MM-DD)', key: 'startDate', placeholder: '2024-01-01' },
              ].map(({ label, key, placeholder, keyboard }) => (
                <View key={key}>
                  <Text style={styles.inputLabel}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={(form as any)[key]}
                    onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType={(keyboard as any) ?? 'default'}
                  />
                </View>
              ))}

              {/* Live EMI preview */}
              {form.principal && form.roi && form.tenureMonths ? (
                <Card style={styles.previewCard} variant="accent">
                  <Text style={styles.previewLabel}>ESTIMATED MONTHLY EMI</Text>
                  <Text style={styles.previewValue}>
                    ₹{formatINR(calculateEMI(
                      parseFloat(form.principal),
                      parseFloat(form.roi),
                      parseInt(form.tenureMonths),
                    ))}
                  </Text>
                </Card>
              ) : null}

              <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>Add Loan</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* ── Amortization Modal ────────────────────────────── */}
        <Modal visible={showAmort && !!selected} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selected ? `${LOAN_EMOJIS[selected.type as LoanType]} ${selected.lender}` : ''}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowAmort(false)}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView
                style={{ padding: Spacing.base }}
                showsVerticalScrollIndicator={false}
              >
                {/* Tax benefits */}
                {taxBenefits && (
                  <Card style={styles.taxCard} variant="accent">
                    <Text style={styles.taxTitle}>🏛 India Tax Benefits (Current FY)</Text>
                    <Divider style={{ marginVertical: Spacing.sm }} />
                    {[
                      {
                        label: 'Sec 24(b) — Interest Deduction',
                        sub: 'Max ₹2 Lakh',
                        value: taxBenefits.sec24bDeduction,
                      },
                      {
                        label: 'Sec 80C — Principal Deduction',
                        sub: 'Max ₹1.5 Lakh',
                        value: taxBenefits.sec80cDeduction,
                      },
                    ].map(item => (
                      <View key={item.label} style={styles.taxRow}>
                        <View>
                          <Text style={styles.taxLabel}>{item.label}</Text>
                          <Text style={styles.taxSub}>{item.sub}</Text>
                        </View>
                        <Text style={[styles.taxValue, { color: Colors.success }]}>
                          ₹{formatINR(item.value)}
                        </Text>
                      </View>
                    ))}
                    <Divider style={{ marginVertical: Spacing.sm }} />
                    <View style={styles.taxRow}>
                      <Text style={[styles.taxLabel, { fontWeight: FontWeight.bold }]}>
                        Total Deduction
                      </Text>
                      <Text style={[styles.taxValue, { color: Colors.primary, fontSize: FontSize.lg }]}>
                        ₹{formatINR(taxBenefits.totalDeduction)}
                      </Text>
                    </View>
                  </Card>
                )}

                {/* Amortization table */}
                <Text style={styles.amortTitle}>Amortization Schedule</Text>
                <View style={styles.amortHeader}>
                  {['Mo.', 'EMI', 'Principal', 'Interest', 'Balance'].map(h => (
                    <Text key={h} style={styles.amortHeaderCell}>{h}</Text>
                  ))}
                </View>
                {amortSchedule.map(row => (
                  <View
                    key={row.month}
                    style={[
                      styles.amortRow,
                      row.month === selected.paidEmis + 1 && styles.amortRowHighlight,
                    ]}
                  >
                    <Text style={styles.amortCell}>{row.month}</Text>
                    <Text style={styles.amortCell}>₹{formatINR(row.emi, true)}</Text>
                    <Text style={[styles.amortCell, { color: Colors.success }]}>
                      ₹{formatINR(row.principal, true)}
                    </Text>
                    <Text style={[styles.amortCell, { color: Colors.danger }]}>
                      ₹{formatINR(row.interest, true)}
                    </Text>
                    <Text style={styles.amortCell}>₹{formatINR(row.balance, true)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Modal>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </>
  );
});

export default EMIScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingTop: Spacing.lg },

  addLoanBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  addLoanBtnText: {
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },

  loanCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  loanTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  loanIconBg: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanEmoji: { fontSize: 20 },
  loanInfo: { flex: 1, gap: 4 },
  loanLender: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  loanRight: { alignItems: 'flex-end' },
  loanEMI: { fontSize: FontSize.md, fontWeight: FontWeight.black },
  loanDue: { fontSize: FontSize.xs, marginTop: 2 },

  loanProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  loanProgressLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  loanProgressPct: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  progressBg: {
    height: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: Radius.full },

  payBtn: {
    backgroundColor: Colors.successDim,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${Colors.success}30`,
    marginTop: 4,
  },
  payBtnText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingTop: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClose: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },

  inputLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.base,
    fontWeight: FontWeight.semibold,
  },
  input: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.base,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  typeBtnActive: { backgroundColor: `${Colors.primary}18` },
  typeBtnEmoji: { fontSize: 14 },
  typeBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  typeBtnTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  previewCard: { marginTop: Spacing.base, alignItems: 'center', paddingVertical: Spacing.lg },
  previewLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: FontWeight.semibold,
  },
  previewValue: {
    fontSize: FontSize.giant,
    fontWeight: FontWeight.black,
    color: Colors.primary,
    marginTop: 4,
    letterSpacing: -1,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.base,
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
    ...Shadow.glow,
  },
  saveBtnText: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.black,
    fontSize: FontSize.base,
    letterSpacing: 0.4,
  },

  taxCard: { marginBottom: Spacing.base },
  taxTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  taxLabel: { fontSize: FontSize.sm, color: Colors.textPrimary },
  taxSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  taxValue: { fontSize: FontSize.base, fontWeight: FontWeight.bold },

  amortTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  amortHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    marginBottom: 4,
  },
  amortHeaderCell: {
    flex: 1,
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amortRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  amortRowHighlight: {
    backgroundColor: `${Colors.primary}18`,
    borderRadius: Radius.sm,
    borderBottomColor: 'transparent',
  },
  amortCell: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
