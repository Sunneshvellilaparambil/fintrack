import React from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, Modal, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { useStores, loadAllStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../theme';
import {
  Card, GlowCard, ProgressBar, SectionHeader, Badge, Divider,
} from '../../components/shared';
import { 
  DonutChart, BarChart, HorizontalBar, StackedBar, RadialProgress, SparkLine 
} from '../../components/Charts';
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
  const [hideBalance, setHideBalance] = React.useState(true);

  // ── Salary check popup state ───────────────────────────────────────────────
  const [showSalaryCheck, setShowSalaryCheck] = React.useState(false);
  const [salaryActualStr, setSalaryActualStr] = React.useState('');
  const [salarySubmitting, setSalarySubmitting] = React.useState(false);

  // Show once per app session on the 1st of the month
  const salaryCheckShown = React.useRef(false);
  React.useEffect(() => {
    const today = new Date();
    if (today.getDate() !== 1) return;
    if (salaryCheckShown.current) return;
    if (budget.monthlyIncome <= 0) return;
    salaryCheckShown.current = true;
    setShowSalaryCheck(true);
  }, [budget.monthlyIncome]);

  const dismissSalaryCheck = (markSeen = true) => {
    if (markSeen) salaryCheckShown.current = true;
    setShowSalaryCheck(false);
    setSalaryActualStr('');
  };

  const handleSalaryConfirm = async (useActual: boolean) => {
    const expected = budget.monthlyIncome;
    const actual = useActual ? parseFloat(salaryActualStr.replace(/,/g, '').trim()) : expected;
    if (useActual && (!Number.isFinite(actual) || actual <= 0)) {
      Alert.alert('Invalid amount', 'Please enter a valid salary amount.');
      return;
    }
    setSalarySubmitting(true);
    try {
      if (useActual && Math.abs(actual - expected) > 1) {
        const monthlySrc = budget.incomeSources.find(i => i.frequency === 'monthly');
        if (monthlySrc) {
          await budget.updateIncomeSource(monthlySrc.id, { amount: actual });
        } else {
          await budget.addIncomeSource({
            name: 'Salary',
            amount: actual,
            frequency: 'monthly',
            date: new Date(),
          });
        }
        Alert.alert('✅ Updated', `Monthly salary updated to ₹${formatINR(actual)}.`);
      } else {
        Alert.alert('✅ Noted', `Salary of ₹${formatINR(actual)} confirmed for this month.`);
      }
      dismissSalaryCheck(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update salary.');
    } finally {
      setSalarySubmitting(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllStores();
    setRefreshing(false);
  };

  /* ── computed values ─────────────────────────────────────────── */

  const totalCreditUsed  = accounts.totalCreditOutstanding;
  const totalCreditLimit = accounts.creditCards.reduce((s, c) => s + (c.creditLimit ?? 0), 0);
  const overallUtil      = totalCreditLimit > 0 ? (totalCreditUsed / totalCreditLimit) * 100 : 0;
  const overallUtilColor = creditUtilizationColor(overallUtil);

  const b = budget.budget;
  const totalSpent = b.needs.spent + b.wants.spent + b.savings.spent;
  const income = budget.monthlyIncome;

  const housingEMI = loans.housingLoans.reduce(
    (s, l) => s + calculateEMI(l.principal, l.roi, l.tenureMonths), 0);
  const vehicleEMI = loans.vehicleLoans.reduce(
    (s, l) => s + calculateEMI(l.principal, l.roi, l.tenureMonths), 0);
  const personalEMI = loans.personalLoans.reduce(
    (s, l) => s + calculateEMI(l.principal, l.roi, l.tenureMonths), 0);

  const spendRatio = income > 0 ? (totalSpent / income) * 100 : 0;
  const spendColor = spendRatio < 60 ? Colors.success
    : spendRatio < 90 ? Colors.warning : Colors.danger;

  const today = new Date();

  // spending trends (last 7 days)
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });
  
  const dailySpendData = last7Days.map(d => {
    const dateStr = d.toISOString().split('T')[0];
    const spent = budget.transactions
      .filter(t => {
        if (!t.date) return false;
        const dObj = t.date instanceof Date ? t.date : new Date(t.date);
        return t.amount < 0 && dObj.toISOString().split('T')[0] === dateStr;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return { 
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }), 
      value: spent,
      color: spent > (income / 30) * 1.5 ? Colors.danger : Colors.primary
    };
  });

  const sparklineData = dailySpendData.map(d => d.value);

  // EMI bar data
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={styles.heroLabel}>LIQUID BALANCE</Text>
                <TouchableOpacity onPress={() => setHideBalance(!hideBalance)} activeOpacity={0.7}>
                  <Icon name={hideBalance ? 'eye-off' : 'eye'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.heroValue, { color: Colors.success }]}>
                {hideBalance ? '₹ ••••••' : `₹${formatINR(accounts.totalLiquid)}`}
              </Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>
                {new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </View>
          
          <Divider style={{ marginVertical: Spacing.sm }} />

          {/* Visual KPI Tiles */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiTile}>
              <Text style={styles.kpiLabel}>INCOME</Text>
              <Text style={[styles.kpiValue, { color: Colors.success }]}>₹{formatINR(income, true)}</Text>
              <SparkLine data={[income*0.9, income*1.1, income]} height={20} width={80} color={Colors.success} filled={false} />
            </View>
            <View style={styles.kpiTile}>
              <Text style={styles.kpiLabel}>SPENT</Text>
              <Text style={[styles.kpiValue, { color: spendColor }]}>₹{formatINR(totalSpent, true)}</Text>
              <ProgressBar pct={spendRatio} color={spendColor} height={4} style={{ marginTop: 8 }} />
            </View>
            <View style={styles.kpiTile}>
              <Text style={styles.kpiLabel}>DUE</Text>
              <Text style={[styles.kpiValue, { color: Colors.danger }]}>₹{formatINR(totalCreditUsed, true)}</Text>
              <RadialProgress pct={overallUtil} color={overallUtilColor} size={30} strokeWidth={4} />
            </View>
          </View>
        </GlowCard>

        {/* ── Spending Trend ────────────────────────────────────── */}
        <SectionHeader title="Recent Spending Trend" />
        <Card style={styles.trendCard}>
          <View style={styles.trendHeader}>
            <View>
              <Text style={styles.trendTitle}>Daily Activity</Text>
              <Text style={styles.trendSub}>Last 7 days spending patterns</Text>
            </View>
            <View style={styles.trendStat}>
              <Text style={styles.trendStatVal}>₹{formatINR(dailySpendData.reduce((s,d)=>s+d.value, 0), true)}</Text>
              <Text style={styles.trendStatLabel}>Week Total</Text>
            </View>
          </View>
          <BarChart data={dailySpendData} height={120} showValues barColor={Colors.primary} />
        </Card>

        {/* ── This Month Spending Breakdown ──────────────────────── */}
        <SectionHeader
          title={`${monthName()} Breakdown`}
          action={
            <TouchableOpacity onPress={() => navigation?.navigate?.('Budget')}>
              <Text style={styles.navBtnText}>Details →</Text>
            </TouchableOpacity>
          }
        />
        <Card style={styles.breakdownCard}>
          <View style={styles.breakdownRow}>
            <DonutChart
              size={130}
              strokeWidth={16}
              centerLabel={`₹${totalSpent >= 1000 ? `${(totalSpent / 1000).toFixed(0)}k` : totalSpent.toFixed(0)}`}
              centerSub="spent"
              showLegend={false}
              slices={[
                { value: b.needs.spent, color: Colors.info, label: 'Needs' },
                { value: b.wants.spent, color: Colors.warning, label: 'Wants' },
                { value: b.savings.spent, color: Colors.success, label: 'Savings' },
              ].filter(s => s.value > 0)}
            />
            <View style={styles.breakdownLegend}>
              {[
                { label: 'Needs', value: b.needs.spent, color: Colors.info },
                { label: 'Wants', value: b.wants.spent, color: Colors.warning },
                { label: 'Savings', value: b.savings.spent, color: Colors.success },
              ].map(item => (
                <View key={item.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.legendLabel}>{item.label}</Text>
                    <Text style={styles.legendValue}>₹{formatINR(item.value, true)}</Text>
                  </View>
                  <Text style={[styles.legendPct, { color: item.color }]}>
                    {income > 0 ? ((item.value / income) * 100).toFixed(0) : 0}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <Divider style={{ marginVertical: Spacing.sm }} />
          <StackedBar 
            height={10}
            segments={[
              { value: b.needs.spent, color: Colors.info, label: 'Needs' },
              { value: b.wants.spent, color: Colors.warning, label: 'Wants' },
              { value: b.savings.spent, color: Colors.success, label: 'Savings' },
              { value: Math.max(0, income - totalSpent), color: Colors.bgElevated, label: 'Remaining' }
            ].filter(s => s.value > 0)}
          />
        </Card>

        {/* ── Budget Health Gauges ────────────────────────────────── */}
        <SectionHeader title="Budget Health (50/30/20)" />
        <View style={styles.gaugeRow}>
          {[
            { label: 'Needs', spent: b.needs.spent, alloc: b.needs.allocated, color: Colors.info },
            { label: 'Wants', spent: b.wants.spent, alloc: b.wants.allocated, color: Colors.warning },
            { label: 'Savings', spent: b.savings.spent, alloc: b.savings.allocated, color: Colors.success },
          ].map(row => {
            const pct = row.alloc > 0 ? (row.spent / row.alloc) * 100 : 0;
            const over = row.spent > row.alloc;
            return (
              <Card key={row.label} style={styles.gaugeCard}>
                <RadialProgress 
                  pct={Math.min(pct, 100)} 
                  color={over ? Colors.danger : row.color} 
                  size={70} 
                  strokeWidth={8}
                  label={`${Math.round(pct)}%`}
                />
                <Text style={styles.gaugeTitle}>{row.label}</Text>
                <Text style={[styles.gaugeSub, { color: over ? Colors.danger : Colors.textMuted }]}>
                  {over ? 'Over!' : 'Healthy'}
                </Text>
              </Card>
            );
          })}
        </View>

        {/* ── EMI Portfolio ───────────────────────────────────────── */}
        <SectionHeader
          title="Debt Portfolio"
          action={
            <TouchableOpacity onPress={() => navigation?.navigate?.('EMI')}>
              <Text style={styles.navBtnText}>Manage →</Text>
            </TouchableOpacity>
          }
        />
        <Card style={styles.emiPortfolioCard}>
          <Text style={styles.chartCaption}>Monthly EMI Distribution</Text>
          <View style={styles.portfolioRow}>
             <DonutChart
                size={110}
                strokeWidth={14}
                centerLabel={`₹${formatINR(loans.totalMonthlyEMI, true)}`}
                centerSub="/mo"
                showLegend={false}
                slices={[
                  { value: housingEMI, color: Colors.info, label: 'Housing' },
                  { value: vehicleEMI, color: Colors.warning, label: 'Vehicle' },
                  { value: personalEMI, color: Colors.danger, label: 'Personal' },
                ].filter(s => s.value > 0)}
              />
              <View style={{ flex: 1, paddingLeft: Spacing.base }}>
                 <BarChart data={emiBarData} height={100} showValues={false} />
              </View>
          </View>
        </Card>

        {/* Horizontal scroll for loan progress visual cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
          {loans.loans.map(loan => {
            const progress = (loan.paidEmis / loan.tenureMonths) * 100;
            const loanColor = loan.type === 'housing' ? Colors.info
              : loan.type === 'vehicle' ? Colors.warning : Colors.danger;
            return (
              <Card key={loan.id} style={styles.scrollCard}>
                <RadialProgress pct={progress} color={loanColor} size={60} strokeWidth={6} label={`${Math.round(progress)}%`} />
                <Text style={styles.scrollCardTitle} numberOfLines={1}>{loan.lender}</Text>
                <Text style={[styles.scrollCardVal, { color: loanColor }]}>₹{formatINR(calculateEMI(loan.principal, loan.roi, loan.tenureMonths), true)}</Text>
              </Card>
            );
          })}
        </ScrollView>

        {/* ── Credit Utilization ─────────────────────────────────── */}
        <SectionHeader
          title="Credit Health"
          action={
            <TouchableOpacity onPress={() => navigation?.navigate?.('Accounts')}>
              <Text style={styles.navBtnText}>All Cards →</Text>
            </TouchableOpacity>
          }
        />
        <Card style={styles.utilCard}>
          <View style={styles.utilTopRow}>
            <View>
              <Text style={styles.utilLabel}>OVERALL UTILIZATION</Text>
              <Text style={[styles.utilBigVal, { color: overallUtilColor }]}>
                {overallUtil.toFixed(1)}%
              </Text>
            </View>
            <RadialProgress pct={overallUtil} color={overallUtilColor} size={80} strokeWidth={10} />
          </View>
          <ProgressBar pct={overallUtil} color={overallUtilColor} height={6} style={{ marginTop: Spacing.sm }} />
          <Text style={styles.utilInfoText}>
            ₹{formatINR(totalCreditUsed)} used of ₹{formatINR(totalCreditLimit)} limit
          </Text>
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
          {accounts.creditCardSummaries.map(summary => {
            const { card, totalOutstanding } = summary;
            const util = card.creditLimit ? (totalOutstanding / card.creditLimit) * 100 : 0;
            const uc = creditUtilizationColor(util);
            return (
              <Card key={card.id} style={styles.scrollCard}>
                <RadialProgress pct={Math.min(util, 100)} color={uc} size={60} strokeWidth={6} label={`${Math.round(util)}%`} />
                <Text style={styles.scrollCardTitle} numberOfLines={1}>{card.bankName}</Text>
                <Text style={[styles.scrollCardVal, { color: uc }]}>₹{formatINR(totalOutstanding, true)}</Text>
              </Card>
            );
          })}
        </ScrollView>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* ── Salary Check Popup ─────────────────────────── */}
      <Modal visible={showSalaryCheck} animationType="fade" transparent>
        <View style={styles.salaryModalBg}>
          <View style={styles.salaryModalCard}>
            <View style={styles.salaryIconRow}>
              <View style={styles.salaryIconCircle}>
                <Icon name="cash" size={32} color={Colors.success} />
              </View>
            </View>
            <Text style={styles.salaryTitle}>💰 Salary Check</Text>
            <Text style={styles.salarySub}>
              It's the 1st! Did your salary get credited this month?
            </Text>
            <View style={styles.salaryExpectedRow}>
              <Text style={styles.salaryExpectedLabel}>EXPECTED SALARY</Text>
              <Text style={styles.salaryExpectedAmt}>₹{formatINR(budget.monthlyIncome)}</Text>
            </View>
            <Text style={[styles.salarySubLabel, { marginTop: Spacing.base }]}>
              Received a different amount? Enter it below:
            </Text>
            <TextInput
              style={styles.salaryInput}
              value={salaryActualStr}
              onChangeText={setSalaryActualStr}
              keyboardType="decimal-pad"
              placeholder={`e.g. ${Math.round(budget.monthlyIncome)}`}
              placeholderTextColor={Colors.textMuted}
            />
            <View style={styles.salaryBtnRow}>
              <TouchableOpacity
                style={[styles.salaryBtnYes, salarySubmitting && { opacity: 0.5 }]}
                disabled={salarySubmitting}
                onPress={() => handleSalaryConfirm(false)}
                activeOpacity={0.8}
              >
                {salarySubmitting
                  ? <ActivityIndicator color={Colors.textPrimary} size="small" />
                  : <Text style={styles.salaryBtnYesTxt}>✓ Yes, Same Amount</Text>}
              </TouchableOpacity>
              {salaryActualStr.trim().length > 0 && (
                <TouchableOpacity
                  style={[styles.salaryBtnUpdate, salarySubmitting && { opacity: 0.5 }]}
                  disabled={salarySubmitting}
                  onPress={() => handleSalaryConfirm(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.salaryBtnUpdateTxt}>Update Amount</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.salarySkip}
              onPress={() => dismissSalaryCheck(true)}
            >
              <Text style={styles.salarySkipTxt}>Remind me later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                You can backup all your financial data to a secure JSON file on your device.
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingTop: Spacing.lg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, marginBottom: Spacing.base,
  },
  greeting: {
    fontSize: FontSize.sm, color: Colors.textSecondary,
    fontWeight: FontWeight.medium, marginBottom: 2,
  },
  headerTitle: {
    fontSize: FontSize.xl, fontWeight: FontWeight.black,
    color: Colors.textPrimary, letterSpacing: -0.5,
  },
  avatarBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.glow,
  },

  heroTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  heroLabel: {
    fontSize: 10, color: Colors.textMuted,
    fontWeight: FontWeight.semibold, letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 4,
  },
  heroValue: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.black,
    letterSpacing: -1, color: Colors.textPrimary,
  },
  heroPill: {
    backgroundColor: Colors.bgElevated, paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.full,
  },
  heroPillText: {
    fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold,
  },

  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm, marginTop: Spacing.xs },
  kpiTile: { flex: 1, alignItems: 'center', gap: 2 },
  kpiLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  kpiValue: { fontSize: FontSize.sm, fontWeight: FontWeight.black },

  trendCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm, padding: Spacing.base },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.base },
  trendTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  trendSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  trendStat: { alignItems: 'flex-end' },
  trendStatVal: { fontSize: FontSize.md, fontWeight: FontWeight.black, color: Colors.primary },
  trendStatLabel: { fontSize: 9, color: Colors.textMuted, textTransform: 'uppercase' },

  breakdownCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.base },
  breakdownLegend: { flex: 1, gap: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase' },
  legendValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  legendPct: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  gaugeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.base, marginBottom: Spacing.sm, gap: Spacing.sm },
  gaugeCard: { flex: 1, alignItems: 'center', padding: Spacing.sm },
  gaugeTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 4 },
  gaugeSub: { fontSize: 9, color: Colors.textMuted },

  emiPortfolioCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  chartCaption: { fontSize: 10, color: Colors.textMuted, fontWeight: FontWeight.bold, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: Spacing.sm },
  portfolioRow: { flexDirection: 'row', alignItems: 'center' },

  horizontalList: { paddingLeft: Spacing.base, marginBottom: Spacing.base },
  scrollCard: { width: 110, marginRight: Spacing.sm, alignItems: 'center', padding: Spacing.sm },
  scrollCardTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginTop: 6 },
  scrollCardVal: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  utilCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  utilTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  utilLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: FontWeight.bold, letterSpacing: 1, textTransform: 'uppercase' },
  utilBigVal: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, letterSpacing: -0.5 },
  utilInfoText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs },

  navBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.bold },

  modalBg: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingTop: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  modalClose: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border },
  actionBtnIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center' },
  actionBtnLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  actionBtnSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  salaryModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: Spacing.lg },
  salaryModalCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm, borderWidth: 1, borderColor: `${Colors.success}30` },
  salaryIconRow: { alignItems: 'center', marginBottom: 4 },
  salaryIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${Colors.success}18`, alignItems: 'center', justifyContent: 'center' },
  salaryTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center' },
  salarySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  salaryExpectedRow: { backgroundColor: `${Colors.success}12`, borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center', marginTop: 4, borderWidth: 1, borderColor: `${Colors.success}25` },
  salaryExpectedLabel: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  salaryExpectedAmt: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.success, letterSpacing: -1 },
  salarySubLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  salaryInput: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.base, color: Colors.textPrimary, fontSize: FontSize.base, borderWidth: 1.5, borderColor: Colors.border },
  salaryBtnRow: { gap: Spacing.sm, marginTop: Spacing.sm },
  salaryBtnYes: { backgroundColor: Colors.success, borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center' },
  salaryBtnYesTxt: { color: Colors.textPrimary, fontWeight: FontWeight.black, fontSize: FontSize.base },
  salaryBtnUpdate: { backgroundColor: Colors.primaryGlow, borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary },
  salaryBtnUpdateTxt: { color: Colors.primaryLight, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  salarySkip: { alignItems: 'center', paddingVertical: Spacing.sm },
  salarySkipTxt: { fontSize: FontSize.xs, color: Colors.textMuted, textDecorationLine: 'underline' },
});
