import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, StatusBar,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../theme';
import { Card, GlowCard, ProgressBar, Badge, SectionHeader, EmptyState, Divider, StatRow } from '../../components/shared';
import { formatINR, creditUtilizationColor } from '../../utils/finance';

const AccountsScreen: React.FC = observer(() => {
  const { accounts } = useStores();
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'debit', bankName: '',
    cardLast2: '', cardType: 'visa',
    creditLimit: '', currentBalance: '', billDate: '', dueDate: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (acc: any) => {
    setEditingId(acc.id);
    setForm({
      name: acc.name,
      type: acc.type,
      bankName: acc.bankName,
      cardLast2: acc.cardLast2 || '',
      cardType: acc.cardType || 'visa',
      creditLimit: String(acc.creditLimit || ''),
      currentBalance: String(acc.currentBalance || ''),
      billDate: acc.billDate ? new Date(acc.billDate).toISOString().split('T')[0] : '',
      dueDate: acc.dueDate ? new Date(acc.dueDate).toISOString().split('T')[0] : '',
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', type: 'debit', bankName: '', cardLast2: '', cardType: 'visa', creditLimit: '', currentBalance: '', billDate: '', dueDate: '' });
  };

  const handleSave = async () => {
    if (!form.name || !form.bankName) {
      Alert.alert('Required', 'Please fill in account name and bank name.');
      return;
    }
    const data = {
      name: form.name,
      type: form.type,
      bankName: form.bankName,
      cardLast2: form.type === 'credit' ? form.cardLast2 : undefined,
      cardType: form.type === 'credit' ? form.cardType : undefined,
      creditLimit: form.type === 'credit' ? parseFloat(form.creditLimit) || 0 : undefined,
      currentBalance: parseFloat(form.currentBalance) || 0,
      billDate: form.type === 'credit' && form.billDate ? new Date(form.billDate) : undefined,
      dueDate: form.type === 'credit' && form.dueDate ? new Date(form.dueDate) : undefined,
    };

    if (editingId) {
      await accounts.updateAccount(editingId, data);
    } else {
      await accounts.addAccount(data);
    }
    setShowAddModal(false);
    resetForm();
  };

  const totalLiquid = accounts.totalLiquid;
  const totalCreditUsed = accounts.totalCreditUsed;
  const totalCreditLimit = accounts.creditCards.reduce((s, c) => s + (c.creditLimit ?? 0), 0);
  const overallUtil = totalCreditLimit > 0 ? (totalCreditUsed / totalCreditLimit) * 100 : 0;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary Hero ────────────────────────────────── */}
        <GlowCard glowColor={Colors.success}>
          <Text style={styles.heroLabel}>TOTAL LIQUID BALANCE</Text>
          <Text style={[styles.heroValue, { color: Colors.success }]}>
            ₹{formatINR(totalLiquid)}
          </Text>
          <Divider style={{ marginVertical: Spacing.sm }} />
          <StatRow
            items={[
              { label: 'Debit Accounts', value: `${accounts.debitAccounts.length}`, color: Colors.info },
              { label: 'Credit Cards', value: `${accounts.creditCards.length}`, color: Colors.warning },
              { label: 'Credit Used', value: `₹${formatINR(totalCreditUsed, true)}`, color: Colors.danger },
            ]}
          />
        </GlowCard>

        {/* ── Debit Accounts ──────────────────────────────── */}
        <SectionHeader
          title={`Debit Accounts (${accounts.debitAccounts.length})`}
          action={
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          }
        />

        {accounts.debitAccounts.length === 0 ? (
          <EmptyState icon="🏦" title="No accounts yet" description="Add your bank accounts to track balances" />
        ) : (
          accounts.debitAccounts.map(acc => (
            <Card key={acc.id} style={styles.accountCard}>
              <TouchableOpacity
                activeOpacity={0.7}
                onLongPress={() => {
                  Alert.alert('Manage Account', acc.name, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Edit', onPress: () => startEdit(acc) },
                    { text: 'Delete', style: 'destructive', onPress: () => accounts.deleteAccount(acc.id) },
                  ]);
                }}
              >
                <View style={styles.accountRow}>
                  <View style={[styles.accountIcon, { backgroundColor: Colors.infoDim }]}>
                    <Text style={styles.accountEmoji}>🏦</Text>
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>{acc.name}</Text>
                    <Text style={styles.accountBank}>{acc.bankName}</Text>
                  </View>
                  <View style={styles.accountRight}>
                    <Text style={[styles.accountBalance, { color: Colors.success }]}>
                      ₹{formatINR(acc.currentBalance)}
                    </Text>
                    <Badge label="DEBIT" color={Colors.info} bgColor={Colors.infoDim} />
                  </View>
                </View>
              </TouchableOpacity>
            </Card>
          ))
        )}

        {/* ── Credit Cards ─────────────────────────────────── */}
        <SectionHeader title={`Credit Cards (${accounts.creditCards.length})`} />

        {accounts.creditCards.length === 0 ? (
          <EmptyState icon="💳" title="No credit cards" description="Add cards to track utilization and due dates" />
        ) : (
          accounts.creditCards.map(card => {
            const util = card.creditLimit
              ? (card.currentBalance / card.creditLimit) * 100 : 0;
            const utilColor = creditUtilizationColor(util);
            const utilLabel = util < 30 ? 'Healthy' : util < 50 ? 'Moderate' : 'High';
            const today = new Date();
            const bDay = card.billDate;
            const dDay = card.dueDate;
            
            let nextDue: Date | null = null;
            if (bDay) {
              if (dDay) {
                 nextDue = accounts.getNextDueDate(bDay, dDay);
              } else {
                 nextDue = accounts.getNextBillDate(bDay);
              }
            }
            
            const daysUntilDue = nextDue
              ? Math.ceil((nextDue.getTime() - today.getTime()) / 86400000)
              : null;

            return (
              <Card key={card.id} style={styles.creditCard}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onLongPress={() => {
                    Alert.alert('Manage Card', card.bankName, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Edit', onPress: () => startEdit(card) },
                      { text: 'Delete', style: 'destructive', onPress: () => accounts.deleteAccount(card.id) },
                    ]);
                  }}
                >
                  <View style={styles.accountRow}>
                    <View style={[styles.accountIcon, { backgroundColor: `${utilColor}18` }]}>
                      <Text style={styles.accountEmoji}>💳</Text>
                    </View>
                    <View style={styles.accountInfo}>
                      <Text style={styles.accountName}>{card.bankName} ···{card.cardLast2}</Text>
                      <View style={styles.badgeRow}>
                        <Badge
                          label={card.cardType?.toUpperCase() ?? 'CARD'}
                          color={Colors.textSecondary}
                          bgColor={Colors.bgElevated}
                        />
                        {daysUntilDue !== null && (
                          <Badge
                            label={dDay ? `Due in ${daysUntilDue}d` : `Bill in ${daysUntilDue}d`}
                            color={daysUntilDue <= 5 ? Colors.danger : Colors.warning}
                            bgColor={daysUntilDue <= 5 ? `${Colors.danger}18` : `${Colors.warning}18`}
                          />
                        )}
                      </View>
                    </View>
                    <View style={styles.accountRight}>
                      <Text style={[styles.accountBalance, { color: utilColor }]}>
                        {util.toFixed(0)}%
                      </Text>
                      <Badge label={utilLabel} color={utilColor} bgColor={`${utilColor}18`} />
                    </View>
                  </View>
                  <View style={styles.utilDetails}>
                    <View style={styles.utilRow}>
                      <Text style={styles.utilLabel}>
                        ₹{formatINR(card.currentBalance, true)} used of ₹{formatINR(card.creditLimit ?? 0, true)}
                      </Text>
                      <Text style={[styles.utilPct, { color: utilColor }]}>{util.toFixed(1)}%</Text>
                    </View>
                    <ProgressBar pct={util} color={utilColor} height={8} />
                    <View style={styles.markers}>
                      <Text style={styles.markerText}>0%</Text>
                      <Text style={[styles.markerText, { color: Colors.warning }]}>30%</Text>
                      <Text style={[styles.markerText, { color: Colors.danger }]}>50%</Text>
                      <Text style={styles.markerText}>100%</Text>
                    </View>
                    {nextDue && (
                      <Text style={styles.billDateInfo}>
                        📅 {dDay ? 'Next due date' : 'Next bill'}: {nextDue.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </Card>
            );
          })
        )}

        {/* Add Account Modal */}
        <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Account' : 'Add Account'}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setShowAddModal(false); resetForm(); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Account Type</Text>
              <View style={styles.typeRow}>
                {['debit', 'credit'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, form.type === t && styles.typeBtnActive]}
                    onPress={() => setForm(f => ({ ...f, type: t }))}
                  >
                    <Text style={styles.typeBtnEmoji}>{t === 'debit' ? '🏦' : '💳'}</Text>
                    <Text style={[styles.typeBtnText, form.type === t && styles.typeBtnTextActive]}>
                      {t === 'debit' ? 'Debit' : 'Credit'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {[
                { label: 'Account Name *', key: 'name', placeholder: 'e.g. SBI Savings' },
                { label: 'Bank Name *', key: 'bankName', placeholder: 'e.g. State Bank of India' },
                { label: 'Current Balance (₹)', key: 'currentBalance', placeholder: '0', keyboard: 'decimal-pad' },
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

              {form.type === 'credit' && (
                <>
                  <Text style={styles.inputLabel}>Last 2 Digits Only</Text>
                  <TextInput
                    style={styles.input}
                    value={form.cardLast2}
                    onChangeText={v => setForm(f => ({ ...f, cardLast2: v.slice(0, 2) }))}
                    placeholder="XX"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  <Text style={styles.securityNote}>🔒 Only last 2 digits stored for security</Text>

                  <Text style={styles.inputLabel}>Card Network</Text>
                  <View style={styles.typeRow}>
                    {['visa', 'mastercard', 'rupay'].map(n => (
                      <TouchableOpacity
                        key={n}
                        style={[styles.typeBtn, form.cardType === n && styles.typeBtnActive]}
                        onPress={() => setForm(f => ({ ...f, cardType: n }))}
                      >
                        <Text style={[styles.typeBtnText, form.cardType === n && styles.typeBtnTextActive]}>
                          {n.charAt(0).toUpperCase() + n.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Credit Limit (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.creditLimit}
                    onChangeText={v => setForm(f => ({ ...f, creditLimit: v }))}
                    placeholder="e.g. 100000"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.inputLabel}>📅 Bill Generation Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.billDate}
                    onChangeText={v => setForm(f => ({ ...f, billDate: v }))}
                    placeholder="e.g. 2024-03-05"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="name-phone-pad"
                    maxLength={10}
                  />
                  
                  <Text style={styles.inputLabel}>📅 Payment Due Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={[styles.input, styles.inputHighlight]}
                    value={form.dueDate}
                    onChangeText={v => setForm(f => ({ ...f, dueDate: v }))}
                    placeholder="e.g. 2024-03-25"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="name-phone-pad"
                    maxLength={10}
                  />
                  <Text style={styles.billDateHint}>
                    Spends are grouped by generation date. Alerts are based on due date.
                  </Text>
                </>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>{editingId ? 'Update Account' : 'Save Account'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </>
  );
});

export default AccountsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingTop: Spacing.lg },
  heroLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroValue: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.black,
    letterSpacing: -1,
    marginBottom: 2,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  addBtnText: { color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  accountCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  creditCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  accountIcon: {
    width: 46, height: 46, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  accountEmoji: { fontSize: 20 },
  accountInfo: { flex: 1, gap: 4 },
  accountName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  accountBank: { fontSize: FontSize.xs, color: Colors.textSecondary },
  accountRight: { alignItems: 'flex-end', gap: 4 },
  accountBalance: { fontSize: FontSize.md, fontWeight: FontWeight.black },
  badgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  utilDetails: { marginTop: Spacing.sm },
  utilRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  utilLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  utilPct: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  markers: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  markerText: { fontSize: 10, color: Colors.textMuted },
  billDateInfo: { fontSize: FontSize.xs, color: Colors.warning, marginTop: 6, fontWeight: FontWeight.semibold },
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
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  modalClose: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  modalBody: { padding: Spacing.base },
  inputLabel: {
    fontSize: FontSize.sm, color: Colors.textSecondary,
    marginBottom: Spacing.xs, marginTop: Spacing.base,
    fontWeight: FontWeight.semibold,
  },
  input: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.base, color: Colors.textPrimary,
    fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border,
  },
  inputHighlight: { borderColor: Colors.warning, borderWidth: 1.5 },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: 4 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  typeBtnActive: { backgroundColor: `${Colors.primary}18`, borderColor: Colors.primary },
  typeBtnEmoji: { fontSize: 14 },
  typeBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  typeBtnTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  securityNote: { fontSize: FontSize.xs, color: Colors.success, marginTop: 6 },
  billDateHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 6, lineHeight: 18 },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    padding: Spacing.base, alignItems: 'center',
    marginTop: Spacing.xl, marginBottom: Spacing.xxl, ...Shadow.glow,
  },
  saveBtnText: { color: Colors.textPrimary, fontWeight: FontWeight.black, fontSize: FontSize.base },
});
