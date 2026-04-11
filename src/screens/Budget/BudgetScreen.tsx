import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, StatusBar,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../theme';
import { Card, GlowCard, ProgressBar, SectionHeader, MetricTile, Divider, StatRow } from '../../components/shared';
import { DonutChart, HorizontalBar, BarChart } from '../../components/Charts';
import { formatINR } from '../../utils/finance';

type BudgetKey = 'needs' | 'wants' | 'savings';

const NEEDS_SUBS = ['groceries', 'utilities', 'rent', 'emi', 'medical', 'transport'];
const WANTS_SUBS = ['dining', 'shopping', 'entertainment', 'travel', 'subscriptions', 'other'];
const SAVINGS_SUBS = ['stocks', 'goal', 'fd', 'ppf', 'epf', 'chitty'];

const BUCKET_CONFIG = [
  { k: 'needs' as BudgetKey, label: 'Needs', pct: 50, emoji: '🏠', color: Colors.info },
  { k: 'wants' as BudgetKey, label: 'Wants', pct: 30, emoji: '🛍', color: Colors.warning },
  { k: 'savings' as BudgetKey, label: 'Savings', pct: 20, emoji: '📈', color: Colors.success },
];

const BudgetScreen: React.FC = observer(({ navigation }: any) => {
  const { budget, accounts } = useStores();
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [txnForm, setTxnForm] = useState({
    accountId: '', amount: '', category: 'wants' as BudgetKey,
    subCategory: 'dining', note: '', isExpense: true,
  });
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);

  const startEditTxn = (t: any) => {
    setEditingTxnId(t.id);
    setTxnForm({
      accountId: t.accountId,
      amount: String(Math.abs(t.amount)),
      category: t.category as BudgetKey,
      subCategory: t.subCategory,
      note: t.note || '',
      isExpense: t.amount < 0,
    });
    setShowAddTxn(true);
  };

  const startEditIncome = (i: any) => {
    setEditingIncomeId(i.id);
    setIncomeForm({
      name: i.name,
      amount: String(i.amount),
      frequency: i.frequency,
    });
    setShowAddIncome(true);
  };

  const resetTxnForm = () => {
    setEditingTxnId(null);
    setTxnForm({
      accountId: '', amount: '', category: 'wants',
      subCategory: 'dining', note: '', isExpense: true,
    });
  };

  const resetIncomeForm = () => {
    setEditingIncomeId(null);
    setIncomeForm({ name: '', amount: '', frequency: 'monthly' });
  };

  const handleSaveTxn = async () => {
    if (!txnForm.amount) { Alert.alert('Error', 'Amount required'); return; }
    const amt = parseFloat(txnForm.amount);
    const data = {
      accountId: txnForm.accountId || 'default',
      amount: txnForm.isExpense ? -Math.abs(amt) : Math.abs(amt),
      category: txnForm.category,
      subCategory: txnForm.subCategory,
      note: txnForm.note,
      date: new Date(),
    };

    if (editingTxnId) {
      await budget.updateTransaction(editingTxnId, data);
    } else {
      await budget.addTransaction(data);
    }
    setShowAddTxn(false);
    resetTxnForm();
  };

  // All payment options: debit accounts + credit cards
  const paymentOptions = [
    ...accounts.debitAccounts.map(a => ({ id: a.id, label: a.name, sub: a.bankName, emoji: '🏦', isCredit: false })),
    ...accounts.creditCards.map(c => ({ id: c.id, label: `${c.bankName} ···${c.cardLast2}`, sub: c.cardType?.toUpperCase() ?? 'CARD', emoji: '💳', isCredit: true })),
  ];
  const [incomeForm, setIncomeForm] = useState({ name: '', amount: '', frequency: 'monthly' });

  const b = budget.budget;

  const handleSaveIncome = async () => {
    if (!incomeForm.name || !incomeForm.amount) { Alert.alert('Error', 'Name and amount required'); return; }
    const data = {
      name: incomeForm.name,
      amount: parseFloat(incomeForm.amount),
      frequency: incomeForm.frequency,
    };
    if (editingIncomeId) {
      await budget.updateIncomeSource(editingIncomeId, data);
    } else {
      await budget.addIncomeSource({ ...data, date: new Date() });
    }
    setShowAddIncome(false);
    resetIncomeForm();
  };

  const subCatsFor = (cat: BudgetKey) =>
    cat === 'needs' ? NEEDS_SUBS : cat === 'wants' ? WANTS_SUBS : SAVINGS_SUBS;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Income Hero ─────────────────────────────────── */}
        <GlowCard glowColor={Colors.success}>
          <View style={styles.incomeTopRow}>
            <MetricTile
              label="Monthly Income"
              value={`₹${formatINR(b.monthlyIncome)}`}
              color={Colors.success}
            />
            <TouchableOpacity
              style={styles.addIncomeBtn}
              onPress={() => setShowAddIncome(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addIncomeBtnText}>+ Income</Text>
            </TouchableOpacity>
          </View>

          {budget.incomeSources.length > 0 && (
            <>
              <Divider style={{ marginVertical: Spacing.sm }} />
              {budget.incomeSources.map(i => (
                <TouchableOpacity
                  key={i.id}
                  activeOpacity={0.7}
                  onLongPress={() => {
                    Alert.alert('Manage Income', i.name, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Edit', onPress: () => startEditIncome(i) },
                      { text: 'Delete', style: 'destructive', onPress: () => budget.deleteIncomeSource(i.id) },
                    ]);
                  }}
                >
                  <View style={styles.incomeItem}>
                    <Text style={styles.incomeName}>{i.name} {i.frequency === 'one-time' && '(One-time)'}</Text>
                    <Text style={[styles.incomeAmt, { color: Colors.success }]}>₹{formatINR(i.amount)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </GlowCard>

        {/* ── Safe-to-Spend ─────────────────────────────── */}
        <Card style={{ ...styles.safeCard, borderColor: b.safeToSpend > 0 ? `${Colors.success}40` : `${Colors.danger}40` }}>
          <View style={styles.safeRow}>
            <View>
              <Text style={styles.safeLabel}>💡 Safe to Spend Right Now</Text>
              <Text style={[styles.safeValue, {
                color: b.safeToSpend > 0 ? Colors.success : Colors.danger,
              }]}>
                ₹{formatINR(b.safeToSpend)}
              </Text>
            </View>
            <View style={[styles.safeIndicator, {
              backgroundColor: b.safeToSpend > 0 ? Colors.successDim : Colors.dangerDim,
            }]}>
              <Text style={{ fontSize: 22 }}>{b.safeToSpend > 0 ? '✅' : '⚠️'}</Text>
            </View>
          </View>
          <Text style={styles.safeSub}>
            {b.safeToSpend > 0
              ? "You're within your Wants budget (30%)."
              : "You've exceeded your Wants budget! Pause discretionary spending."}
          </Text>
          <ProgressBar
            pct={(b.wants.spent / (b.wants.allocated || 1)) * 100}
            color={b.safeToSpend > 0 ? Colors.success : Colors.danger}
            height={6}
            style={{ marginTop: Spacing.sm }}
          />
        </Card>

        {/* ── 50/30/20 Buckets ─────────────────────────── */}
        <SectionHeader
          title="50/30/20 Breakdown"
          action={
            <TouchableOpacity
              style={styles.addTxnBtn}
              onPress={() => setShowAddTxn(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addTxnBtnText}>+ Transaction</Text>
            </TouchableOpacity>
          }
        />

        {BUCKET_CONFIG.map(({ k, label, pct, emoji, color }) => {
          const bucket = b[k];
          const spentPct = bucket.allocated > 0
            ? Math.min(100, (bucket.spent / bucket.allocated) * 100) : 0;
          const isOver = bucket.remaining < 0;
          return (
            <Card key={k} style={styles.bucketCard}>
              <View style={styles.bucketTop}>
                <View style={[styles.bucketIconBg, { backgroundColor: `${color}18` }]}>
                  <Text style={styles.bucketEmoji}>{emoji}</Text>
                </View>
                <View style={styles.bucketInfo}>
                  <Text style={styles.bucketLabel}>{label} ({pct}%)</Text>
                  <Text style={styles.bucketAlloc}>Allocated: ₹{formatINR(bucket.allocated)}</Text>
                </View>
                <View style={styles.bucketRight}>
                  <Text style={[styles.bucketRemaining, { color: isOver ? Colors.danger : color }]}>
                    {isOver ? '-' : ''}₹{formatINR(Math.abs(bucket.remaining), true)}
                  </Text>
                  <Text style={styles.bucketRemainingLabel}>{isOver ? 'over budget' : 'remaining'}</Text>
                </View>
              </View>
              <ProgressBar pct={spentPct} color={isOver ? Colors.danger : color} height={8} style={{ marginTop: Spacing.sm }} />
              <View style={styles.bucketStats}>
                <Text style={styles.bucketStat}>Spent: ₹{formatINR(bucket.spent)}</Text>
                <Text style={[styles.bucketStat, { color: isOver ? Colors.danger : color }]}>
                  {spentPct.toFixed(0)}%
                </Text>
              </View>
            </Card>
          );
        })}

        {/* ── Recent Transactions ──────────────────────── */}
        <SectionHeader title="Recent Transactions" />
        {budget.transactions.length === 0 ? (
          <Card style={styles.emptyTxnCard}>
            <Text style={styles.emptyTxnText}>No transactions yet</Text>
          </Card>
        ) : (
          budget.transactions
            .slice()
            .sort((a, b) => +b.date - +a.date)
            .slice(0, 20)
            .map(t => (
              <Card key={t.id} style={styles.txnCard}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onLongPress={() => {
                    Alert.alert('Manage Transaction', t.subCategory, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Edit', onPress: () => startEditTxn(t) },
                      { text: 'Delete', style: 'destructive', onPress: () => budget.deleteTransaction(t.id) },
                    ]);
                  }}
                >
                  <View style={styles.txnRow}>
                    <View style={[styles.txnDot, {
                      backgroundColor: t.amount < 0 ? Colors.dangerDim : Colors.successDim,
                      borderColor: t.amount < 0 ? `${Colors.danger}40` : `${Colors.success}40`,
                    }]}>
                      <Text style={{ fontSize: 12 }}>{t.amount < 0 ? '↓' : '↑'}</Text>
                    </View>
                    <View style={styles.txnLeft}>
                      <Text style={styles.txnSub}>{t.subCategory}</Text>
                      {t.note ? <Text style={styles.txnNote}>{t.note}</Text> : null}
                      <Text style={styles.txnDate}>
                        {new Date(t.date).toLocaleDateString('en-IN')}
                      </Text>
                    </View>
                    <Text style={[styles.txnAmount, {
                      color: t.amount < 0 ? Colors.danger : Colors.success,
                    }]}>
                      {t.amount < 0 ? '-' : '+'}₹{formatINR(Math.abs(t.amount))}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Card>
            ))
        )}

        {/* Add Transaction Modal */}
        <Modal visible={showAddTxn} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingTxnId ? 'Edit Transaction' : 'Add Transaction'}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setShowAddTxn(false); resetTxnForm(); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: Spacing.base }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeRow}>
                {[{ k: true, l: '💸 Expense' }, { k: false, l: '💰 Income' }].map(({ k, l }) => (
                  <TouchableOpacity
                    key={String(k)}
                    style={[styles.typeBtn, txnForm.isExpense === k && styles.typeBtnActive]}
                    onPress={() => setTxnForm(f => ({ ...f, isExpense: k }))}
                  >
                    <Text style={[styles.typeBtnText, txnForm.isExpense === k && styles.typeBtnTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Payment Method */}
              {paymentOptions.length > 0 && (
                <>
                  <Text style={styles.inputLabel}>💳 Payment Method</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                    {paymentOptions.map(opt => (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.paymentChip,
                          txnForm.accountId === opt.id && [
                            styles.paymentChipActive,
                            opt.isCredit && styles.paymentChipCredit,
                          ],
                        ]}
                        onPress={() => setTxnForm(f => ({ ...f, accountId: f.accountId === opt.id ? '' : opt.id }))}
                      >
                        <Text style={styles.paymentChipEmoji}>{opt.emoji}</Text>
                        <View>
                          <Text style={[
                            styles.paymentChipLabel,
                            txnForm.accountId === opt.id && styles.paymentChipLabelActive,
                          ]}>{opt.label}</Text>
                          <Text style={styles.paymentChipSub}>{opt.sub}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {txnForm.accountId && paymentOptions.find(o => o.id === txnForm.accountId)?.isCredit && (
                    <View style={styles.creditNote}>
                      <Text style={styles.creditNoteText}>
                        💳 This spend will be tracked against the card's billing cycle
                      </Text>
                    </View>
                  )}
                </>
              )}
              <Text style={styles.inputLabel}>Amount (₹)</Text>
              <TextInput
                style={styles.input}
                value={txnForm.amount}
                onChangeText={v => setTxnForm(f => ({ ...f, amount: v }))}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.typeRow}>
                {(['needs', 'wants', 'savings'] as BudgetKey[]).map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.typeBtn, txnForm.category === c && styles.typeBtnActive]}
                    onPress={() => setTxnForm(f => ({ ...f, category: c, subCategory: subCatsFor(c)[0] }))}
                  >
                    <Text style={[styles.typeBtnText, txnForm.category === c && styles.typeBtnTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Sub-category</Text>
              <View style={styles.typeRow}>
                {subCatsFor(txnForm.category).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.typeBtn, txnForm.subCategory === s && styles.typeBtnActive]}
                    onPress={() => setTxnForm(f => ({ ...f, subCategory: s }))}
                  >
                    <Text style={[styles.typeBtnText, txnForm.subCategory === s && styles.typeBtnTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Note (optional)</Text>
              <TextInput
                style={styles.input}
                value={txnForm.note}
                onChangeText={v => setTxnForm(f => ({ ...f, note: v }))}
                placeholder="What was this for?"
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTxn} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>{editingTxnId ? 'Update Transaction' : 'Add Transaction'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* Add Income Modal */}
        <Modal visible={showAddIncome} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingIncomeId ? 'Edit Income' : 'Add Income Source'}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setShowAddIncome(false); resetIncomeForm(); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: Spacing.base }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput style={styles.input} value={incomeForm.name} onChangeText={v => setIncomeForm(f => ({ ...f, name: v }))} placeholder="e.g. Salary" placeholderTextColor={Colors.textMuted} />
              <Text style={styles.inputLabel}>Amount (₹/month)</Text>
              <TextInput style={styles.input} value={incomeForm.amount} onChangeText={v => setIncomeForm(f => ({ ...f, amount: v }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
              <Text style={styles.inputLabel}>Frequency</Text>
              <View style={styles.typeRow}>
                {['monthly', 'one-time'].map(f => (
                  <TouchableOpacity key={f} style={[styles.typeBtn, incomeForm.frequency === f && styles.typeBtnActive]} onPress={() => setIncomeForm(fm => ({ ...fm, frequency: f }))}>
                    <Text style={[styles.typeBtnText, incomeForm.frequency === f && styles.typeBtnTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveIncome} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>{editingIncomeId ? 'Update Income' : 'Save Income'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </>
  );
});

export default BudgetScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingTop: Spacing.lg },
  incomeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  addIncomeBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  addIncomeBtnText: { color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  incomeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  incomeName: { color: Colors.textPrimary, fontSize: FontSize.sm },
  incomeAmt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  safeCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1.5,
  },
  safeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  safeLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
  safeValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, letterSpacing: -0.5 },
  safeIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 6, lineHeight: 18 },
  addTxnBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  addTxnBtnText: { color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  bucketCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  bucketTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bucketIconBg: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bucketEmoji: { fontSize: 22 },
  bucketInfo: { flex: 1 },
  bucketLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  bucketAlloc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  bucketRight: { alignItems: 'flex-end' },
  bucketRemaining: { fontSize: FontSize.md, fontWeight: FontWeight.black },
  bucketRemainingLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  bucketStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  bucketStat: { fontSize: FontSize.xs, color: Colors.textSecondary },
  emptyTxnCard: { margin: Spacing.base, alignItems: 'center', paddingVertical: Spacing.xl },
  emptyTxnText: { color: Colors.textMuted, fontSize: FontSize.sm },
  txnCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.xs, padding: Spacing.sm },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  txnDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  txnLeft: { flex: 1 },
  txnSub: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium, textTransform: 'capitalize' },
  txnNote: { fontSize: FontSize.xs, color: Colors.textSecondary },
  txnDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  txnAmount: { fontSize: FontSize.md, fontWeight: FontWeight.black },
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
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
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
  typeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: 4 },
  typeBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  typeBtnActive: { backgroundColor: `${Colors.primary}18`, borderColor: Colors.primary },
  typeBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  typeBtnTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.base,
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
    ...Shadow.glow,
  },
  saveBtnText: { color: Colors.textPrimary, fontWeight: FontWeight.black, fontSize: FontSize.base },

  // Payment method chips
  paymentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.bgCard,
    marginRight: 8, marginTop: 4,
  },
  paymentChipActive: { backgroundColor: `${Colors.info}18`, borderColor: Colors.info },
  paymentChipCredit: { backgroundColor: `${Colors.warning}18`, borderColor: Colors.warning },
  paymentChipEmoji: { fontSize: 16 },
  paymentChipLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary,
  },
  paymentChipLabelActive: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  paymentChipSub: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  creditNote: {
    backgroundColor: `${Colors.warning}12`,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: `${Colors.warning}25`,
  },
  creditNoteText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.medium },
});
