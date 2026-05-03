import React from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, Modal, Alert, TextInput,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { useStores, loadAllStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../theme';
import {
  Card, GlowCard, ProgressBar, SectionHeader, Badge, Divider, StatRow,
} from '../../components/shared';
import { DonutChart, BarChart, HorizontalBar, StackedBar } from '../../components/Charts';
import { formatINR, creditUtilizationColor, calculateEMI } from '../../utils/finance';
import { exportData, importData } from '../../utils/backup';
import Icon from 'react-native-vector-icons/Ionicons';

/* ─── helpers ─────────────────────────────────────────────────────────── */

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', icon: 'sunny' };
  if (h < 17) return { text: 'Good afternoon', icon: 'partly-sunny' };
  return { text: 'Good evening', icon: 'moon' };
};

const monthName = () =>
  new Date().toLocaleString('en-IN', { month: 'long' });

/* ─── screen ──────────────────────────────────────────────────────────── */

const DashboardScreen: React.FC = observer(({ navigation }: any) => {
  const { auth, accounts, loans, budget } = useStores();
  const [refreshing, setRefreshing] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllStores();
    setRefreshing(false);
  };

  /* ── computed values ─────────────────────────────────────────── */

  const totalCreditUsed = accounts.creditCards.reduce(
    (s, c) => s + (c.currentBalance ?? 0), 0,
  );
  const totalCreditLimit = accounts.creditCards.reduce(
    (s, c) => s + (c.creditLimit ?? 0), 0,
  );
  const overallUtil = totalCreditLimit > 0
    ? (totalCreditUsed / totalCreditLimit) * 100 : 0;
  const overallUtilColor = creditUtilizationColor(overallUtil);

  const b = budget.budget;
  const totalSpent = b.needs.spent + b.wants.spent + b.savings.spent;
  const income = budget.monthlyIncome;

  // Loan type breakdown for donut
  const housingEMI = loans.housingLoans.reduce(
    (s, l) => s + calculateEMI(l.principal, l.roi, l.tenureMonths), 0);
  const vehicleEMI = loans.vehicleLoans.reduce(
    (s, l) => s + calculateEMI(l.principal, l.roi, l.tenureMonths), 0);
  const personalEMI = loans.personalLoans.reduce(
    (s, l) => s + calculateEMI(l.principal, l.roi, l.tenureMonths), 0);

  // spending health
  const spendRatio = income > 0 ? (totalSpent / income) * 100 : 0;
  const spendColor = spendRatio < 60 ? Colors.success
    : spendRatio < 90 ? Colors.warning : Colors.danger;

  const today = new Date();
  const daysUntilEMI = (emiDay: number) => {
    const next = new Date(today.getFullYear(), today.getMonth(), emiDay);
    if (next <= today) next.setMonth(next.getMonth() + 1);
    return Math.ceil((next.getTime() - today.getTime()) / 86400000);
  };

  // sub-category spending this month
  const subSpend: Record<string, number> = {};
  budget.transactions.forEach(t => {
    const d = new Date(t.date);
    if (
      t.amount < 0 &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    ) {
      subSpend[t.subCategory] = (subSpend[t.subCategory] ?? 0) + Math.abs(t.amount);
    }
  });
  const subSpendArr = Object.entries(subSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // recent transactions
  const recentTxns = budget.transactions
    .slice()
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 5);

  /* ── EMI bar data ────────────────────────────────────────────── */
  const emiBarData = loans.loans.slice(0, 6).map(l => ({
    label: l.lender.split(' ')[0].slice(0, 7),
    value: Math.round(calculateEMI(l.principal, l.roi, l.tenureMonths)),
    color: l.type === 'housing' ? Colors.info
      : l.type === 'vehicle' ? Colors.warning : Colors.danger,
  }));

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Icon name={greeting().icon} size={16} color={Colors.warning} />
              <Text style={styles.greeting}>{greeting().text}</Text>
            </View>
            <Text style={styles.headerTitle}>Financial Overview</Text>
          </View>
          <TouchableOpacity style={styles.avatarBtn} activeOpacity={0.8} onPress={() => setShowSettings(true)}>
            <Icon name="settings-outline" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* ── Net Summary Hero ─────────────────────────────────── */}
        <GlowCard glowColor={Colors.primary}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>LIQUID BALANCE</Text>
              <Text style={[styles.heroValue, { color: Colors.success }]}>
                ₹{formatINR(accounts.totalLiquid)}
              </Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>
                {new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </View>
          <Divider style={{ marginVertical: Spacing.sm }} />
          <StatRow
            items={[
              {
                label: 'Monthly EMI',
                value: `₹${formatINR(loans.totalMonthlyEMI, true)}`,
                color: Colors.warning,
              },
              {
                label: 'Due on cards',
                value: `₹${formatINR(totalCreditUsed)}`,
                color: Colors.danger,
              },
              {
                label: 'Monthly Income',
                value: income > 0 ? `₹${formatINR(income, true)}` : 'Not set',
                color: Colors.success,
              },
            ]}
          />
        </GlowCard>

        {/* ── This Month Spending ───────────────────────────────── */}
        <SectionHeader
          title={`${monthName()} Spending`}
          action={
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => navigation?.navigate?.('Budget')}
              activeOpacity={0.7}
            >
              <Text style={styles.navBtnText}>Details →</Text>
            </TouchableOpacity>
          }
        />

        <Card style={styles.spendCard}>
          {totalSpent > 0 ? (
            <>
              {/* Donut */}
              <DonutChart
                size={150}
                strokeWidth={20}
                centerLabel={`₹${totalSpent >= 1000
                  ? `${(totalSpent / 1000).toFixed(0)}k` : totalSpent.toFixed(0)}`}
                centerSub="spent"
                showLegend
                slices={[
                  { value: b.needs.spent, color: Colors.info, label: `Needs  ₹${formatINR(b.needs.spent, true)}` },
                  { value: b.wants.spent, color: Colors.warning, label: `Wants  ₹${formatINR(b.wants.spent, true)}` },
                  { value: b.savings.spent, color: Colors.success, label: `Savings  ₹${formatINR(b.savings.spent, true)}` },
                ].filter(s => s.value > 0)}
              />

              <Divider style={{ marginVertical: Spacing.sm }} />

              {/* Income vs spent stacked bar */}
              {income > 0 && (
                <View style={styles.incomeVsSpend}>
                  <View style={styles.incomeRow}>
                    <Text style={styles.vs50Label}>Income</Text>
                    <Text style={[styles.vs50Val, { color: Colors.success }]}>
                      ₹{formatINR(income)}
                    </Text>
                  </View>
                  <View style={styles.incomeRow}>
                    <Text style={styles.vs50Label}>Spent</Text>
                    <Text style={[styles.vs50Val, { color: spendColor }]}>
                      ₹{formatINR(totalSpent)}
                      {'  '}
                      <Text style={[styles.vs50Pct, { color: spendColor }]}>
                        ({spendRatio.toFixed(0)}%)
                      </Text>
                    </Text>
                  </View>
                  <ProgressBar
                    pct={Math.min(spendRatio, 100)}
                    color={spendColor}
                    height={8}
                    style={{ marginTop: 6 }}
                  />
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptySpend}>
              <Icon name="pie-chart-outline" size={48} color={Colors.textMuted} style={{ marginBottom: Spacing.sm }} />
              <Text style={styles.emptyTitle}>No spending recorded yet</Text>
              <Text style={styles.emptySub}>
                Go to Budget → + Transaction to add spending
              </Text>
            </View>
          )}
        </Card>

        {/* ── Spend by Category ─────────────────────────────────── */}
        {subSpendArr.length > 0 && (
          <>
            <SectionHeader title="Top Spending Categories" />
            <Card style={styles.catCard}>
              {subSpendArr.map(([cat, amt]) => (
                <HorizontalBar
                  key={cat}
                  label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                  value={amt}
                  max={subSpendArr[0][1]}
                  color={Colors.primary}
                  valueLabel={`₹${formatINR(amt, true)}`}
                />
              ))}
            </Card>
          </>
        )}

        {/* ── Budget Health ─────────────────────────────────────── */}
        {income > 0 && (
          <>
            <SectionHeader title="50 / 30 / 20 Budget Health" />
            <Card style={styles.budgetCard}>
              {[
                { label: 'Needs 50%', spent: b.needs.spent, alloc: b.needs.allocated, color: Colors.info },
                { label: 'Wants 30%', spent: b.wants.spent, alloc: b.wants.allocated, color: Colors.warning },
                { label: 'Savings 20%', spent: b.savings.spent, alloc: b.savings.allocated, color: Colors.success },
              ].map(row => {
                const pct = row.alloc > 0
                  ? Math.min((row.spent / row.alloc) * 100, 100) : 0;
                const over = row.spent > row.alloc;
                return (
                  <View key={row.label} style={styles.budgetRow}>
                    <View style={styles.budgetLeft}>
                      <Text style={styles.budgetLabel}>{row.label}</Text>
                      <Text style={[styles.budgetStat, { color: over ? Colors.danger : Colors.textMuted }]}>
                        ₹{formatINR(row.spent, true)} / ₹{formatINR(row.alloc, true)}
                        {over ? '  ⚠ over' : ''}
                      </Text>
                    </View>
                    <View style={styles.budgetRight}>
                      <Text style={[styles.budgetPct, { color: over ? Colors.danger : row.color }]}>
                        {pct.toFixed(0)}%
                      </Text>
                    </View>
                    <View style={styles.budgetBarWrap}>
                      <ProgressBar
                        pct={pct}
                        color={over ? Colors.danger : row.color}
                        height={6}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* ── EMI Calendar ─────────────────────────────────────── */}
        <SectionHeader
          title="EMI Due This Month"
          action={
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => navigation?.navigate?.('EMI')}
              activeOpacity={0.7}
            >
              <Text style={styles.navBtnText}>Manage →</Text>
            </TouchableOpacity>
          }
        />

        {loans.loans.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Icon name="calendar-outline" size={48} color={Colors.textMuted} style={{ marginBottom: Spacing.sm }} />
            <Text style={styles.emptyTitle}>No active loans</Text>
            <Text style={styles.emptySub}>Add loans in EMI tab to track dues</Text>
          </Card>
        ) : (
          <>
            {/* EMI Bar chart */}
            {emiBarData.length > 1 && (
              <Card style={styles.emiBarCard}>
                <Text style={styles.chartCaption}>Monthly EMI by Lender</Text>
                <BarChart data={emiBarData} height={140} showValues />
              </Card>
            )}

            {/* EMI Loan cards */}
            {loans.loans.slice(0, 3).map(loan => {
              const emi = calculateEMI(loan.principal, loan.roi, loan.tenureMonths);
              const days = daysUntilEMI(loan.emiDay);
              const isUrgent = days <= 5;
              const progress = (loan.paidEmis / loan.tenureMonths) * 100;
              const loanColor = loan.type === 'housing' ? Colors.info
                : loan.type === 'vehicle' ? Colors.warning : Colors.danger;
              return (
                <TouchableOpacity
                  key={loan.id}
                  activeOpacity={0.75}
                  onPress={() => navigation?.navigate?.('EMI')}
                >
                  <Card style={StyleSheet.flatten([styles.loanCard, { borderLeftWidth: 3, borderLeftColor: loanColor }]) as any}>
                    <View style={styles.loanRow}>
                      <View style={[styles.loanIcon, { backgroundColor: `${loanColor}18` }]}>
                        <Icon 
                          name={loan.type === 'housing' ? 'home' : loan.type === 'vehicle' ? 'car' : 'person'} 
                          size={20} 
                          color={loanColor} 
                        />
                      </View>
                      <View style={styles.loanInfo}>
                        <Text style={styles.loanName}>{loan.lender}</Text>
                        <Badge
                          label={loan.type.toUpperCase()}
                          color={loanColor}
                          bgColor={`${loanColor}18`}
                        />
                      </View>
                      <View style={styles.loanRight}>
                        <Text style={[styles.loanEmi, { color: loanColor }]}>
                          ₹{formatINR(emi)}/mo
                        </Text>
                        <Text style={[styles.loanDue, {
                          color: isUrgent ? Colors.danger : Colors.textMuted,
                        }]}>
                          {isUrgent ? '🔴 ' : '🟡 '}Due in {days}d
                        </Text>
                      </View>
                    </View>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>
                        {loan.paidEmis}/{loan.tenureMonths} paid
                      </Text>
                      <Text style={[styles.progressPct, { color: loanColor }]}>
                        {progress.toFixed(0)}%
                      </Text>
                    </View>
                    <ProgressBar pct={progress} color={loanColor} height={6} />
                  </Card>
                </TouchableOpacity>
              );
            })}

            {/* Debt composition donut */}
            {(housingEMI + vehicleEMI + personalEMI) > 0 && (
              <Card style={styles.debtDonut}>
                <Text style={styles.chartCaption}>Debt Composition</Text>
                <DonutChart
                  size={140}
                  strokeWidth={18}
                  centerLabel={`₹${formatINR(loans.totalMonthlyEMI, true)}`}
                  centerSub="/month"
                  showLegend
                  slices={[
                    housingEMI > 0 && { value: housingEMI, color: Colors.info, label: `Housing` },
                    vehicleEMI > 0 && { value: vehicleEMI, color: Colors.warning, label: `Vehicle` },
                    personalEMI > 0 && { value: personalEMI, color: Colors.danger, label: `Personal` },
                  ].filter(Boolean) as any}
                />
              </Card>
            )}
          </>
        )}

        {/* ── Credit Utilization ───────────────────────────────── */}
        {accounts.creditCards.length > 0 && (
          <>
            <SectionHeader
              title="Credit Utilization"
              action={
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => navigation?.navigate?.('Accounts')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.navBtnText}>All cards →</Text>
                </TouchableOpacity>
              }
            />

            <Card style={styles.utilCard}>
              <View style={styles.utilTop}>
                <View>
                  <Text style={styles.heroLabel}>OVERALL UTILIZATION</Text>
                  <Text style={[styles.utilBig, { color: overallUtilColor }]}>
                    {overallUtil.toFixed(1)}%
                  </Text>
                </View>
                <Badge
                  label={overallUtil < 30 ? '✓ HEALTHY' : overallUtil < 50 ? '⚠ MODERATE' : '✗ HIGH'}
                  color={overallUtilColor}
                  bgColor={`${overallUtilColor}18`}
                />
              </View>
              <ProgressBar
                pct={overallUtil}
                color={overallUtilColor}
                height={10}
                style={{ marginVertical: Spacing.sm }}
              />
              <Text style={styles.utilSub}>
                ₹{formatINR(totalCreditUsed)} outstanding of ₹{formatINR(totalCreditLimit)} total limit
              </Text>
            </Card>

            {accounts.creditCards.map(card => {
              const util = card.creditLimit
                ? (card.currentBalance / card.creditLimit) * 100 : 0;
              const uc = creditUtilizationColor(util);
              return (
                <Card key={card.id} style={styles.creditCard}>
                  <View style={styles.loanRow}>
                    <View style={[styles.loanIcon, { backgroundColor: `${uc}15` }]}>
                      <Icon name="card" size={20} color={uc} />
                    </View>
                    <View style={styles.loanInfo}>
                      <Text style={styles.loanName}>{card.bankName} ···{card.cardLast2}</Text>
                      <Text style={styles.cardSub}>
                        ₹{formatINR(card.currentBalance)} owed · ₹{formatINR(card.creditLimit ?? 0)} limit
                      </Text>
                    </View>
                    <Text style={[styles.utilBig2, { color: uc }]}>{util.toFixed(0)}%</Text>
                  </View>
                  <ProgressBar pct={util} color={uc} height={6} style={{ marginTop: Spacing.sm }} />
                </Card>
              );
            })}
          </>
        )}



        {/* ── Recent Transactions ──────────────────────────────── */}
        {recentTxns.length > 0 && (
          <>
            <SectionHeader
              title="Recent Transactions"
              action={
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => navigation?.navigate?.('Budget')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.navBtnText}>All →</Text>
                </TouchableOpacity>
              }
            />
            <Card style={styles.txnsCard}>
              {recentTxns.map((t, i) => (
                <View key={t.id}>
                  <View style={styles.txnRow}>
                    <View style={[styles.txnDot, {
                      backgroundColor: t.amount < 0 ? Colors.dangerDim : Colors.successDim,
                    }]}>
                      <Icon 
                        name={t.amount < 0 ? 'arrow-down' : 'arrow-up'} 
                        size={16} 
                        color={t.amount < 0 ? Colors.danger : Colors.success} 
                      />
                    </View>
                    <View style={styles.txnInfo}>
                      <Text style={styles.txnSub}>
                        {t.subCategory.charAt(0).toUpperCase() + t.subCategory.slice(1)}
                      </Text>
                      {t.note ? <Text style={styles.txnNote}>{t.note}</Text> : null}
                      <Text style={styles.txnDate}>
                        {new Date(t.date).toLocaleDateString('en-IN')}
                      </Text>
                    </View>
                    <Text style={[styles.txnAmt, {
                      color: t.amount < 0 ? Colors.danger : Colors.success,
                    }]}>
                      {t.amount < 0 ? '-' : '+'}₹{formatINR(Math.abs(t.amount))}
                    </Text>
                  </View>
                  {i < recentTxns.length - 1 && (
                    <Divider style={{ marginVertical: 6 }} />
                  )}
                </View>
              ))}
            </Card>
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* ── Settings Modal ────────────────────────────────────── */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalBg}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowSettings(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.base }}>
            
            <SectionHeader title="Profile Management" />
            
            <Card style={{ marginBottom: Spacing.base }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.base }}>
                <Text style={{ fontSize: 32, marginRight: Spacing.sm }}>{auth.activeProfile?.emoji || '👤'}</Text>
                <View>
                  <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary }}>Current Profile</Text>
                  <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary }}>
                    {auth.activeProfile?.name || 'User'}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.actionBtn} 
                activeOpacity={0.8} 
                onPress={() => {
                  setShowSettings(false);
                  runInAction(() => {
                    auth.activeProfile = null;
                  });
                }}
              >
                <View style={styles.actionBtnIcon}>
                  <Icon name="swap-horizontal" size={24} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.actionBtnLabel}>Switch Profile</Text>
                  <Text style={styles.actionBtnSub}>Change to a different user profile</Text>
                </View>
              </TouchableOpacity>
            </Card>

            <SectionHeader title="Data Management" />
            
            <Card style={{ marginBottom: Spacing.base }}>
              <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.base, lineHeight: 20 }}>
                You can backup all your financial data (accounts, transactions, loans, etc.) to a secure JSON file on your device.
              </Text>
              
              <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={exportData}>
                <View style={styles.actionBtnIcon}>
                  <Icon name="save-outline" size={24} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.actionBtnLabel}>Backup Data</Text>
                  <Text style={styles.actionBtnSub}>Save current data to phone storage</Text>
                </View>
              </TouchableOpacity>
              
              <Divider style={{ marginVertical: Spacing.sm }} />
              
              <TouchableOpacity style={[styles.actionBtn, { marginTop: 4 }]} activeOpacity={0.8} onPress={importData}>
                <View style={styles.actionBtnIcon}>
                  <Icon name="download-outline" size={24} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.actionBtnLabel}>Restore Data</Text>
                  <Text style={styles.actionBtnSub}>Load from a previous backup file</Text>
                </View>
              </TouchableOpacity>
            </Card>

            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
        </View>
      </Modal>

    </>
  );
});

export default DashboardScreen;

/* ─── styles ──────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingTop: Spacing.lg },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.base,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  avatarBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.glow,
  },

  // Hero
  heroTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  heroLabel: {
    fontSize: FontSize.xs, color: Colors.textMuted,
    fontWeight: FontWeight.semibold, letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 4,
  },
  heroValue: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.black,
    letterSpacing: -1, color: Colors.textPrimary,
  },
  heroPill: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.full,
  },
  heroPillText: {
    fontSize: FontSize.xs, color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },

  // Nav buttons
  navBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.full, backgroundColor: `${Colors.primary}18`,
  },
  navBtnText: {
    fontSize: FontSize.xs, color: Colors.primaryLight,
    fontWeight: FontWeight.semibold,
  },

  // This month spending
  spendCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  emptySpend: { alignItems: 'center', paddingVertical: Spacing.lg },
  emptyCard: {
    marginHorizontal: Spacing.base, marginBottom: Spacing.sm,
    alignItems: 'center', paddingVertical: Spacing.xl,
  },
  emptyIcon: { fontSize: 32, marginBottom: Spacing.sm },
  emptyTitle: {
    fontSize: FontSize.base, fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: FontSize.xs, color: Colors.textMuted,
    marginTop: 4, textAlign: 'center',
  },

  incomeVsSpend: { gap: 4 },
  incomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vs50Label: { fontSize: FontSize.sm, color: Colors.textSecondary },
  vs50Val: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  vs50Pct: { fontSize: FontSize.xs },

  chartCaption: {
    fontSize: FontSize.xs, color: Colors.textMuted,
    fontWeight: FontWeight.semibold, letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: Spacing.sm,
  },

  // Category bars
  catCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },

  // Budget health
  budgetCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm, gap: Spacing.sm },
  budgetRow: { gap: 4 },
  budgetLeft: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  budgetLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1,
  },
  budgetStat: { fontSize: FontSize.xs },
  budgetRight: {},
  budgetPct: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  budgetBarWrap: {},

  // EMI
  emiBarCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  debtDonut: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  loanCard: {
    marginHorizontal: Spacing.base, marginBottom: Spacing.sm, gap: Spacing.sm,
  },
  loanRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  loanIcon: {
    width: 44, height: 44, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  loanEmoji: { fontSize: 20 },
  loanInfo: { flex: 1, gap: 4 },
  loanName: {
    fontSize: FontSize.base, fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  loanRight: { alignItems: 'flex-end' },
  loanEmi: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  loanDue: { fontSize: FontSize.xs, marginTop: 2 },
  progressRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4,
  },
  progressLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  progressPct: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  // Credit
  utilCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  utilTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  utilBig: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, letterSpacing: -0.5 },
  utilBig2: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  utilSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  creditCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  cardSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // Recent transactions
  txnsCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  txnDot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  txnDotText: { fontSize: 12, color: Colors.textSecondary },
  txnInfo: { flex: 1 },
  txnSub: {
    fontSize: FontSize.sm, fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  txnNote: { fontSize: FontSize.xs, color: Colors.textSecondary },
  txnDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  txnAmt: { fontSize: FontSize.md, fontWeight: FontWeight.black },

  // Credit card bill section
  billCard: {
    marginHorizontal: Spacing.base, marginBottom: Spacing.sm, gap: Spacing.sm,
  },
  billHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  billCardLeft: { flex: 1 },
  billCardTitle: {
    fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary,
  },
  billCycleLabel: {
    fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2,
  },
  billCardRight: { alignItems: 'flex-end' },
  billDaysLeft: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  billTotal: {
    fontSize: FontSize.lg, fontWeight: FontWeight.black, color: Colors.textPrimary, marginTop: 2,
  },
  noSpends: {
    fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic', paddingVertical: 4,
  },
  billSpendRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  billSpendInfo: { flex: 1 },
  billSpendSub: {
    fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary, textTransform: 'capitalize',
  },
  billSpendDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  billSpendAmt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  moreTxns: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold,
    textAlign: 'center', paddingTop: Spacing.xs,
  },

  // Settings Modal
  modalBg: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingTop: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  modalClose: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  actionBtnIcon: { 
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryDim, 
    alignItems: 'center', justifyContent: 'center' 
  },
  actionBtnLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  actionBtnSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  // Pay Bill modal logic
  payBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  payBtnText: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  inputLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.base, fontWeight: FontWeight.medium },
  input: { backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.base, color: Colors.textPrimary, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.xxl },
  saveBtnText: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  
  paymentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.bgCard,
    marginRight: 8,
  },
  paymentChipActive: { backgroundColor: `${Colors.info}18`, borderColor: Colors.info },
  paymentChipEmoji: { fontSize: 16 },
  paymentChipLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  paymentChipLabelActive: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  paymentChipSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
});
