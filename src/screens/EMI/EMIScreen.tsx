import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, StatusBar, Switch,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../theme';
import { Card, GlowCard, Badge, SectionHeader, EmptyState, Divider, MetricTile, StatRow } from '../../components/shared';
import { formatINR, calculateEMI, generateAmortization, calculateTaxBenefits, calculateROIFromEMI } from '../../utils/finance';

type LoanType = 'housing' | 'vehicle' | 'personal';

const LOAN_COLORS: Record<LoanType, string> = {
  housing: Colors.info,
  vehicle: Colors.warning,
  personal: Colors.danger,
};

const LOAN_EMOJIS: Record<LoanType, string> = {
  housing: '🏠',
  vehicle: 'car-outline',
  personal: '👤',
};

const EMIScreen: React.FC = observer(() => {
  const { loans, accounts } = useStores();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);
  const [showAmort, setShowAmort] = useState(false);
  const [unknownInterest, setUnknownInterest] = useState(false);
  const [alreadyStarted, setAlreadyStarted] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [form, setForm] = useState({
    type: 'housing' as LoanType, lender: '', principal: '',
    roi: '', tenureMonths: '', emiDay: '5',
    startDate: new Date().toISOString().split('T')[0],
    emiAmount: '',   // used when interest rate is unknown
    completedEmis: '', // used when loan is already in progress
  });
  const [contribForm, setContribForm] = useState({
    memberId: '', amount: '', description: '', isJointEmi: false, accountId: '',
  });
  const [editingLoanId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      type: 'housing', lender: '', principal: '', roi: '', tenureMonths: '', emiDay: '5',
      startDate: new Date().toISOString().split('T')[0], emiAmount: '', completedEmis: '',
    });
    setContribForm({
      memberId: '', amount: '', description: '', isJointEmi: false, accountId: '',
    });
    setUnknownInterest(false);
    setAlreadyStarted(false);
    setSelectedAccountId('');
  };

  const startEdit = (loan: any) => {
    setEditingId(loan.id);
    const emi = calculateEMI(loan.principal, loan.roi, loan.tenureMonths);
    setForm({
      type: loan.type,
      lender: loan.lender,
      principal: String(loan.principal),
      roi: String(loan.roi),
      tenureMonths: String(loan.tenureMonths),
      emiDay: String(loan.emiDay),
      startDate: new Date(loan.startDate).toISOString().split('T')[0],
      emiAmount: String(Math.round(emi)),
      completedEmis: String(loan.paidEmis),
    });
    setUnknownInterest(false);
    setAlreadyStarted(loan.paidEmis > 0);
    setSelectedAccountId(loan.accountId || '');
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!form.lender || !form.principal || !form.tenureMonths) {
      Alert.alert('Error', 'Please fill in all required fields.'); return;
    }
    if (unknownInterest && !form.emiAmount) {
      Alert.alert('Error', 'Please enter your EMI amount.'); return;
    }
    if (!unknownInterest && !form.roi) {
      Alert.alert('Error', 'Please enter the interest rate.'); return;
    }
    const completedEmisNum = alreadyStarted ? parseInt(form.completedEmis || '0') : 0;
    const tenureNum = parseInt(form.tenureMonths);
    if (alreadyStarted && completedEmisNum >= tenureNum) {
      Alert.alert('Error', 'Completed EMIs cannot be ≥ total tenure months.'); return;
    }

    let roi: number;
    if (unknownInterest) {
      roi = calculateROIFromEMI(
        parseFloat(form.emiAmount),
        parseFloat(form.principal),
        parseInt(form.tenureMonths),
      );
    } else {
      roi = parseFloat(form.roi);
    }

    const data = {
      type: form.type,
      lender: form.lender,
      principal: parseFloat(form.principal),
      roi,
      tenureMonths: tenureNum,
      startDate: new Date(form.startDate),
      emiDay: parseInt(form.emiDay),
      paidEmis: completedEmisNum,
      accountId: selectedAccountId || undefined,
    };

    if (editingLoanId) {
      await loans.updateLoan(editingLoanId, data);
    } else {
      await loans.addLoan(data);
    }
    setShowAddModal(false);
    resetForm();
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

  const creditCardIds = new Set(accounts.creditCards.map(c => c.id));
  const paymentOptions = [
    ...accounts.debitAccounts.map(a => ({ id: a.id, label: a.name ?? a.bankName, sub: a.bankName, emoji: 'business-outline', isCredit: false })),
    ...accounts.creditCards.map(c => ({ id: c.id, label: `${c.bankName} ···${c.cardLast2}`, sub: 'Pay later (Credit)', emoji: 'card-outline', isCredit: true })),
  ];

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
            icon="calendar-outline"
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
            const start = new Date(loan.startDate);
            const nextDue = new Date(start.getFullYear(), start.getMonth() + loan.paidEmis, loan.emiDay);
            const days = Math.ceil((nextDue.getTime() - today.getTime()) / 86400000);
            const isUrgent = days <= 5 && remaining > 0;
            const progressPct = (loan.paidEmis / loan.tenureMonths) * 100;
            const remainingAmount = remaining * emi;
            const formattedNextDate = nextDue.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

            return (
              <TouchableOpacity
                 key={loan.id}
                 activeOpacity={0.75}
                 onPress={() => { setSelectedLoan(loan.id); setShowAmort(true); }}
                 onLongPress={() => {
                   Alert.alert('Manage Loan', loan.lender, [
                     { text: 'Cancel', style: 'cancel' },
                     { text: 'Edit', onPress: () => startEdit(loan) },
                     { text: 'Delete Loan', style: 'destructive', onPress: () => {
                       Alert.alert('Delete', 'Are you sure?', [
                         { text: 'No' },
                         { text: 'Yes', onPress: () => loans.deleteLoan(loan.id) }
                       ]);
                     }},
                   ]);
                 }}
               >
                <Card style={StyleSheet.flatten([styles.loanCard, { borderLeftColor: color, borderLeftWidth: 3 }]) as any}>
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
                        color: remaining === 0 ? Colors.success : (isUrgent ? Colors.danger : Colors.textMuted),
                      }]}>
                        {remaining === 0 ? '🎉 Fully Paid' : `${isUrgent ? '🔴 ' : ''}${days < 0 ? `Overdue by ${Math.abs(days)}d` : `Due in ${days}d`}`}
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
                  <View style={{ height: 16 }} />
                  <StatRow
                    items={[
                      { label: 'Rem. Amount', value: `₹${formatINR(remainingAmount, true)}`, color: Colors.danger },
                      { label: 'Next Date', value: formattedNextDate, color: isUrgent ? Colors.danger : undefined },
                    ]}
                  />

                  {/* Payment method badge */}
                  {loan.accountId && (() => {
                    const payOpt = paymentOptions.find(p => p.id === loan.accountId);
                    if (!payOpt) return null;
                    const isCC = creditCardIds.has(loan.accountId);
                    return (
                      <View style={styles.paymentBadgeRow}>
                        <Text style={styles.paymentBadgeEmoji}>{payOpt.emoji}</Text>
                        <Text style={[
                          styles.paymentBadgeText,
                          { color: isCC ? Colors.warning : Colors.info },
                        ]}>
                          {isCC ? 'Credit Card EMI' : 'Debit Account'} · {payOpt.label}
                        </Text>
                      </View>
                    );
                  })()}

                  {/* Pay button */}
                  <TouchableOpacity
                    style={[
                      styles.payBtn,
                      remaining === 0 && { opacity: 0.5, backgroundColor: Colors.bgElevated, borderColor: Colors.border }
                    ]}
                    activeOpacity={0.8}
                    disabled={remaining === 0}
                    onPress={() => {
                      if (loan.paidEmis >= loan.tenureMonths) {
                        Alert.alert('Payment Restricted', 'All EMIs for this loan have already been paid. Please check your records.');
                        return;
                      }

                      const isCC = loan.accountId ? creditCardIds.has(loan.accountId) : false;
                      const payOpt = loan.accountId ? paymentOptions.find(p => p.id === loan.accountId) : null;
                      const msg = isCC
                        ? `Mark ₹${formatINR(emi)} as paid for ${formattedNextDate}?\n\nRemaining EMIs: ${remaining}\nRemaining Amount: ₹${formatINR(remainingAmount, true)}\n\n💳 EMI will also be added to ${payOpt?.label ?? 'your card'}'s bill cycle.`
                        : `Mark ₹${formatINR(emi)} as paid for ${formattedNextDate}?\n\nRemaining EMIs: ${remaining}\nRemaining Amount: ₹${formatINR(remainingAmount, true)}`;
                        Alert.alert('Mark EMI Paid', msg, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Confirm', onPress: async () => {
                              await loans.markEMIPaid(loan.id, creditCardIds);
                              if (isCC && payOpt?.id) {
                                await accounts.recalculateCardBalance(payOpt.id);
                              }
                          }},
                        ]);
                    }}
                  >
                    <Text style={[styles.payBtnText, remaining === 0 && { color: Colors.textMuted }]}>
                      {remaining === 0 ? '✓  Loan Completed' : '✓  Mark This Month Paid'}
                    </Text>
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
              <Text style={styles.modalTitle}>{editingLoanId ? 'Edit Loan' : 'Add Loan'}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => { setShowAddModal(false); resetForm(); }}
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

              {/* Static fields: Lender, Principal, Tenure, EMI Day, Start Date */}
              {[
                { label: 'Lender / Bank *', key: 'lender', placeholder: 'e.g. SBI Home Loan' },
                { label: 'Principal Amount (₹) *', key: 'principal', placeholder: 'e.g. 5000000', keyboard: 'decimal-pad' },
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

              {/* ── Unknown Interest Toggle ───────────────────────────── */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelCol}>
                  <Text style={styles.toggleTitle}>I don't know the interest rate</Text>
                  <Text style={styles.toggleSub}>App will calculate it from your EMI amount</Text>
                </View>
                <Switch
                  value={unknownInterest}
                  onValueChange={v => {
                    setUnknownInterest(v);
                    setForm(f => ({ ...f, roi: '', emiAmount: '' }));
                  }}
                  trackColor={{ false: Colors.border, true: `${Colors.primary}88` }}
                  thumbColor={unknownInterest ? Colors.primary : Colors.textMuted}
                />
              </View>

              {/* Conditional: Interest Rate OR Known EMI Amount */}
              {unknownInterest ? (
                <View>
                  <Text style={styles.inputLabel}>Your EMI Amount (₹) *</Text>
                  <TextInput
                    style={[styles.input, styles.inputHighlight]}
                    value={form.emiAmount}
                    onChangeText={v => setForm(f => ({ ...f, emiAmount: v }))}
                    placeholder="e.g. 9800"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
              ) : (
                <View>
                  <Text style={styles.inputLabel}>Annual Interest Rate (%) *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.roi}
                    onChangeText={v => setForm(f => ({ ...f, roi: v }))}
                    placeholder="e.g. 8.5"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              {/* Tenure + EMI Day + Start Date */}
              {[
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

              {/* ── Already Started Toggle ─────────────────────────── */}
              <View style={[styles.toggleRow, { marginTop: Spacing.base }]}>
                <View style={styles.toggleLabelCol}>
                  <Text style={styles.toggleTitle}>🔄 Loan already in progress?</Text>
                  <Text style={styles.toggleSub}>Enter how many EMIs you've already paid</Text>
                </View>
                <Switch
                  value={alreadyStarted}
                  onValueChange={v => {
                    setAlreadyStarted(v);
                    setForm(f => ({ ...f, completedEmis: '' }));
                  }}
                  trackColor={{ false: Colors.border, true: `${Colors.warning}88` }}
                  thumbColor={alreadyStarted ? Colors.warning : Colors.textMuted}
                />
              </View>

              {/* Completed Tenure Details */}
              {alreadyStarted && (
                <View>
                  {/* Completed EMIs input */}
                  <Text style={styles.inputLabel}>Completed EMIs (paid so far) *</Text>
                  <TextInput
                    style={[styles.input, styles.inputHighlightWarning]}
                    value={form.completedEmis}
                    onChangeText={v => setForm(f => ({ ...f, completedEmis: v }))}
                    placeholder="e.g. 24"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                  />

                  {/* Derived dates info card */}
                  {form.startDate && form.tenureMonths ? (() => {
                    const start = new Date(form.startDate);
                    const tenure = parseInt(form.tenureMonths) || 0;
                    const completed = parseInt(form.completedEmis || '0');
                    const remaining = tenure - completed;

                    const endDate = new Date(start);
                    endDate.setMonth(endDate.getMonth() + tenure);

                    const nextEmiDate = new Date(start);
                    nextEmiDate.setMonth(nextEmiDate.getMonth() + completed);

                    const fmt = (d: Date) =>
                      d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                    return (
                      <View style={styles.tenureInfoCard}>
                        <Text style={styles.tenureInfoTitle}>calendar-outline Tenure Details</Text>
                        <View style={styles.tenureInfoRow}>
                          <View style={styles.tenureInfoItem}>
                            <Text style={styles.tenureInfoLabel}>START DATE</Text>
                            <Text style={styles.tenureInfoValue}>{fmt(start)}</Text>
                          </View>
                          <View style={[styles.tenureInfoItem, styles.tenureInfoItemMid]}>
                            <Text style={styles.tenureInfoLabel}>END DATE</Text>
                            <Text style={[styles.tenureInfoValue, { color: Colors.danger }]}>{fmt(endDate)}</Text>
                          </View>
                          <View style={styles.tenureInfoItem}>
                            <Text style={styles.tenureInfoLabel}>NEXT EMI</Text>
                            <Text style={[styles.tenureInfoValue, { color: Colors.warning }]}>{fmt(nextEmiDate)}</Text>
                          </View>
                        </View>
                        <View style={styles.tenureProgressRow}>
                          <Text style={styles.tenureProgressText}>
                            {completed} paid · {remaining > 0 ? remaining : 0} remaining
                          </Text>
                          <Text style={styles.tenureProgressPct}>
                            {tenure > 0 ? ((completed / tenure) * 100).toFixed(0) : 0}% done
                          </Text>
                        </View>
                        <View style={styles.progressBg}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${tenure > 0 ? Math.min((completed / tenure) * 100, 100) : 0}%`,
                                backgroundColor: Colors.warning,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })() : null}
                </View>
              )}

              {/* Live Preview */}
              {unknownInterest
                ? (form.principal && form.emiAmount && form.tenureMonths ? (() => {
                    const computedROI = calculateROIFromEMI(
                      parseFloat(form.emiAmount),
                      parseFloat(form.principal),
                      parseInt(form.tenureMonths),
                    );
                    return (
                      <Card style={styles.previewCard} variant="accent">
                        <Text style={styles.previewLabel}>CALCULATED INTEREST RATE</Text>
                        <Text style={styles.previewValue}>{computedROI > 0 ? `${computedROI}% p.a.` : '0% (Interest-free)'}</Text>
                        <Text style={[styles.previewLabel, { marginTop: 8 }]}>EMI YOU ENTERED</Text>
                        <Text style={[styles.previewValue, { color: Colors.warning, fontSize: FontSize.xl }]}>
                          ₹{formatINR(parseFloat(form.emiAmount))}/mo
                        </Text>
                      </Card>
                    );
                  })() : null)
                : (form.principal && form.roi && form.tenureMonths ? (
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
                  ) : null)
              }

              {/* ── Payment Method ──────────────────────────── */}
              {paymentOptions.length > 0 && (
                <View style={{ marginTop: Spacing.base }}>
                  <Text style={styles.inputLabel}>card-outline EMI Payment Method</Text>
                  <Text style={styles.paymentHint}>Which account/card will this EMI be debited from?</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {/* None option */}
                    <TouchableOpacity
                      style={[
                        styles.paymentChip,
                        !selectedAccountId && styles.paymentChipActive,
                      ]}
                      onPress={() => setSelectedAccountId('')}
                    >
                      <Text style={styles.paymentChipEmoji}>🚫</Text>
                      <View>
                        <Text style={[
                          styles.paymentChipLabel,
                          !selectedAccountId && styles.paymentChipLabelActive,
                        ]}>Not linked</Text>
                        <Text style={styles.paymentChipSub}>Skip</Text>
                      </View>
                    </TouchableOpacity>

                    {paymentOptions.map(opt => (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.paymentChip,
                          selectedAccountId === opt.id && [
                            styles.paymentChipActive,
                            opt.isCredit && styles.paymentChipCredit,
                          ],
                        ]}
                        onPress={() => setSelectedAccountId(id => id === opt.id ? '' : opt.id)}
                      >
                        <Text style={styles.paymentChipEmoji}>{opt.emoji}</Text>
                        <View>
                          <Text style={[
                            styles.paymentChipLabel,
                            selectedAccountId === opt.id && styles.paymentChipLabelActive,
                          ]}>{opt.label}</Text>
                          <Text style={styles.paymentChipSub}>{opt.sub}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Credit card warning */}
                  {selectedAccountId && creditCardIds.has(selectedAccountId) && (() => {
                    const opt = paymentOptions.find(p => p.id === selectedAccountId);
                    const billDay = accounts.creditCards.find(c => c.id === selectedAccountId)?.billDate;
                    return (
                      <View style={styles.ccEmiNote}>
                        <Text style={styles.ccEmiNoteText}>
                          card-outline Each time you mark this EMI paid, ₹{form.principal && form.roi && form.tenureMonths
                            ? formatINR(calculateEMI(parseFloat(form.principal), parseFloat(form.roi || '0'), parseInt(form.tenureMonths)))
                            : '...'} will be added to {opt?.label ?? 'the card'}'s billing cycle
                          {billDay ? ` (bill closes on ${billDay}th)` : ''}.
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={async () => {
                await handleSave();
                if (selectedAccountId && creditCardIds.has(selectedAccountId)) {
                  await accounts.recalculateCardBalance(selectedAccountId);
                }
              }} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>{editingLoanId ? 'Update Loan' : 'Add Loan'}</Text>
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

  // Unknown interest toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginTop: Spacing.base,
  },
  toggleLabelCol: { flex: 1, marginRight: Spacing.base },
  toggleTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  toggleSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  inputHighlight: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  inputHighlightWarning: {
    borderColor: Colors.warning,
    borderWidth: 1.5,
  },

  // Tenure info card
  tenureInfoCard: {
    marginTop: Spacing.base,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: `${Colors.warning}30`,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  tenureInfoTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  tenureInfoRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  tenureInfoItem: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  tenureInfoItemMid: {
    borderWidth: 1,
    borderColor: `${Colors.danger}25`,
  },
  tenureInfoLabel: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  tenureInfoValue: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  tenureProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tenureProgressText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  tenureProgressPct: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.warning,
  },

  // Payment method styles
  paymentBadgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${Colors.warning}10`,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${Colors.warning}25`,
    alignSelf: 'flex-start',
  },
  paymentBadgeEmoji: { fontSize: 12 },
  paymentBadgeText: { fontSize: 10, fontWeight: FontWeight.semibold },
  paymentHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  paymentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.bgCard,
    marginRight: 8,
  },
  paymentChipActive: { backgroundColor: `${Colors.info}18`, borderColor: Colors.info },
  paymentChipCredit: { backgroundColor: `${Colors.warning}18`, borderColor: Colors.warning },
  paymentChipEmoji: { fontSize: 16 },
  paymentChipLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  paymentChipLabelActive: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  paymentChipSub: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  ccEmiNote: {
    backgroundColor: `${Colors.warning}12`,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: `${Colors.warning}30`,
  },
  ccEmiNoteText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.medium, lineHeight: 18 },

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
