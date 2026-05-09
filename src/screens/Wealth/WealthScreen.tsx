import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../theme';
import { Card, ProgressBar, SectionHeader, EmptyState, Divider, Badge, MetricTile } from '../../components/shared';
import { formatINR, sipFutureValue, inflationAdjustedValue, debtToIncomeRatio, affordabilityScore } from '../../utils/finance';

const WealthScreen: React.FC = observer(() => {
  const { wealth, loans, budget, accounts } = useStores();
  const [activeTab, setActiveTab] = useState<'portfolio' | 'goals' | 'chitty' | 'rd' | 'retirement' | 'planner'>('portfolio');
  const [showModal, setShowModal] = useState<string | null>(null);
  const [stockForm, setStockForm] = useState({ symbol: '', name: '', quantity: '', avgBuyPrice: '', currentPrice: '' });
  const [goalForm, setGoalForm] = useState({ name: '', targetAmount: '', targetDate: '', color: '#6C63FF' });
  const [chittyForm, setChittyForm] = useState({ name: '', monthlyInstallment: '', totalValue: '', durationMonths: '', startDate: new Date().toISOString().split('T')[0] });
  const [priceUpdate, setPriceUpdate] = useState({ stockId: '', price: '' });
  const [goalFund, setGoalFund] = useState({ goalId: '', amount: '', accountId: '' });
  const [chittyDividend, setChittyDividend] = useState({ chittyId: '', amount: '', accountId: '' });
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingChittyId, setEditingChittyId] = useState<string | null>(null);
  const [editingRDId, setEditingRDId] = useState<string | null>(null);
  const [rdForm, setRDForm] = useState({ name: '', monthlyInstallment: '', durationMonths: '', roi: '', startDate: new Date().toISOString().split('T')[0], depositDay: '1', accountId: '' });

  const resetGoalForm = () => {
    setEditingGoalId(null);
    setGoalForm({ name: '', targetAmount: '', targetDate: '', color: '#6C63FF' });
  };
  const resetStockForm = () => {
    setEditingStockId(null);
    setStockForm({ symbol: '', name: '', quantity: '', avgBuyPrice: '', currentPrice: '' });
  };
  const resetChittyForm = () => {
    setEditingChittyId(null);
    setChittyForm({ name: '', monthlyInstallment: '', totalValue: '', durationMonths: '', startDate: new Date().toISOString().split('T')[0] });
  };
  const resetRDForm = () => {
    setEditingRDId(null);
    setRDForm({ name: '', monthlyInstallment: '', durationMonths: '', roi: '', startDate: new Date().toISOString().split('T')[0], depositDay: '1', accountId: '' });
  };

  const startEditGoal = (g: any) => {
    setEditingGoalId(g.id);
    setGoalForm({
      name: g.name,
      targetAmount: String(g.targetAmount),
      targetDate: g.targetDate ? new Date(g.targetDate).toISOString().split('T')[0] : '',
      color: g.color || '#6C63FF',
    });
    setShowModal('goal_add');
  };

  const startEditStock = (s: any) => {
    setEditingStockId(s.id);
    setStockForm({
      symbol: s.symbol,
      name: s.name,
      quantity: String(s.quantity),
      avgBuyPrice: String(s.avgBuyPrice),
      currentPrice: String(s.currentPrice),
    });
    setShowModal('stock_add');
  };

  const startEditChitty = (c: any) => {
    setEditingChittyId(c.id);
    setChittyForm({
      name: c.name,
      monthlyInstallment: String(c.monthlyInstallment),
      totalValue: String(c.totalValue),
      durationMonths: String(c.durationMonths),
      startDate: c.startDate ? new Date(c.startDate).toISOString().split('T')[0] : '',
    });
    setShowModal('chitty_add');
  };

  const startEditRD = (r: any) => {
    setEditingRDId(r.id);
    setRDForm({
      name: r.name,
      monthlyInstallment: String(r.monthlyInstallment),
      durationMonths: String(r.durationMonths),
      roi: String(r.roi),
      startDate: r.startDate ? new Date(r.startDate).toISOString().split('T')[0] : '',
      depositDay: String(r.depositDay),
      accountId: r.accountId || '',
    });
    setShowModal('rd_add');
  };

  const handleSaveStock = async () => {
    if (!stockForm.symbol || !stockForm.quantity || !stockForm.avgBuyPrice) {
      Alert.alert('Error', 'Symbol, quantity and avg price required'); return;
    }
    const data = {
      symbol: stockForm.symbol.toUpperCase(),
      name: stockForm.name || stockForm.symbol.toUpperCase(),
      quantity: parseFloat(stockForm.quantity),
      avgBuyPrice: parseFloat(stockForm.avgBuyPrice),
      currentPrice: parseFloat(stockForm.currentPrice) || parseFloat(stockForm.avgBuyPrice),
    };
    if (editingStockId) {
      await wealth.deleteStock(editingStockId);
      await wealth.addStock(data);
    } else {
      await wealth.addStock(data);
    }
    setShowModal(null);
    resetStockForm();
  };

  const handleSaveGoal = async () => {
    if (!goalForm.name || !goalForm.targetAmount) {
      Alert.alert('Error', 'Name and target amount required'); return;
    }
    const data = {
      name: goalForm.name,
      targetAmount: parseFloat(goalForm.targetAmount),
      targetDate: goalForm.targetDate ? new Date(goalForm.targetDate) : new Date(Date.now() + 365 * 86400000),
      color: goalForm.color,
    };
    if (editingGoalId) {
      await wealth.updateGoal(editingGoalId, data);
    } else {
      await wealth.addGoal(data);
    }
    setShowModal(null);
    resetGoalForm();
  };

  const handleSaveChitty = async () => {
    if (!chittyForm.name || !chittyForm.monthlyInstallment) {
      Alert.alert('Error', 'Name and monthly installment required'); return;
    }
    const data = {
      name: chittyForm.name,
      monthlyInstallment: parseFloat(chittyForm.monthlyInstallment),
      totalValue: parseFloat(chittyForm.totalValue) || 0,
      durationMonths: parseInt(chittyForm.durationMonths) || 12,
      startDate: new Date(chittyForm.startDate),
    };
    if (editingChittyId) {
      await wealth.updateChitty(editingChittyId, data);
    } else {
      await wealth.addChitty(data);
    }
    setShowModal(null);
    resetChittyForm();
  };

  const handleSaveRD = async () => {
    if (!rdForm.name || !rdForm.monthlyInstallment || !rdForm.durationMonths) {
      Alert.alert('Error', 'Name, installment and duration required'); return;
    }
    const data = {
      name: rdForm.name,
      monthlyInstallment: parseFloat(rdForm.monthlyInstallment),
      durationMonths: parseInt(rdForm.durationMonths),
      roi: parseFloat(rdForm.roi) || 0,
      startDate: new Date(rdForm.startDate),
      depositDay: parseInt(rdForm.depositDay) || 1,
      accountId: rdForm.accountId || undefined,
    };
    if (editingRDId) {
      await wealth.updateRD(editingRDId, data);
    } else {
      await wealth.addRD(data);
    }
    setShowModal(null);
    resetRDForm();
  };

  // Retirement planner state
  const [retForm, setRetForm] = useState({ currentAge: '30', retireAge: '60', monthlyContrib: '', expectedReturn: '12', inflation: '6' });

  const GOAL_COLORS = ['#6C63FF', '#00D9A3', '#FFB84D', '#FF5C5C', '#4FC3F7', '#FF85A1'];

  const tabs = [
    { key: 'portfolio', label: '📈 Portfolio' },
    { key: 'goals', label: 'flag-outline Goals' },
    { key: 'chitty', label: 'wallet-outline Chitty' },
    { key: 'rd', label: '🏦 RD' },
    { key: 'retirement', label: '🛡 Retirement' },
    { key: 'planner', label: '🏡 Property' },
  ] as const;

  // handled by handleSaveStock/Goal/Chitty now

  // Retirement calculation
  const retYears = parseInt(retForm.retireAge) - parseInt(retForm.currentAge);
  const retCorpus = retForm.monthlyContrib
    ? sipFutureValue(parseFloat(retForm.monthlyContrib), parseFloat(retForm.expectedReturn), retYears)
    : 0;
  const inflationAdjustedCorpus = retCorpus
    ? inflationAdjustedValue(retCorpus, -parseFloat(retForm.inflation), retYears)
    : 0;

  // Property planner
  const dti = debtToIncomeRatio(loans.totalMonthlyEMI, budget.monthlyIncome);
  const affordability = affordabilityScore(dti);
  const maxAdditionalEMI = Math.max(0, budget.monthlyIncome * 0.5 - loans.totalMonthlyEMI);

  const netWorth = accounts.totalLiquid + wealth.portfolioValue + wealth.totalGoalsFunded;

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: Spacing.xxl }}>

        {/* ── Portfolio ──────────────────────────────────────────────────── */}
        {activeTab === 'portfolio' && (
          <>
            {/* Net Worth Hero */}
            <Card style={styles.heroCard} variant="elevated">
              <Text style={styles.heroLabel}>ESTIMATED NET WORTH</Text>
              <Text style={styles.heroValue}>₹{formatINR(netWorth)}</Text>
              <View style={styles.heroRow}>
                <View style={styles.heroItem}>
                  <Text style={styles.heroItemLabel}>Liquid Cash</Text>
                  <Text style={[styles.heroItemValue, { color: Colors.success }]}>
                    ₹{formatINR(accounts.totalLiquid, true)}
                  </Text>
                </View>
                <View style={styles.heroSep} />
                <View style={styles.heroItem}>
                  <Text style={styles.heroItemLabel}>Portfolio</Text>
                  <Text style={[styles.heroItemValue, { color: wealth.portfolioPnL >= 0 ? Colors.success : Colors.danger }]}>
                    ₹{formatINR(wealth.portfolioValue, true)}
                  </Text>
                </View>
                <View style={styles.heroSep} />
                <View style={styles.heroItem}>
                  <Text style={styles.heroItemLabel}>Goals</Text>
                  <Text style={[styles.heroItemValue, { color: Colors.info }]}>
                    ₹{formatINR(wealth.totalGoalsFunded, true)}
                  </Text>
                </View>
              </View>
            </Card>

            <Card style={styles.heroCard}>
              <Text style={styles.heroLabel}>PORTFOLIO VALUE</Text>
              <Text style={styles.heroValue}>₹{formatINR(wealth.portfolioValue)}</Text>
              <View style={styles.pnlRow}>
                <Badge
                  label={`${wealth.portfolioPnL >= 0 ? '+' : ''}₹${formatINR(wealth.portfolioPnL)} (${wealth.portfolioPnLPct >= 0 ? '+' : ''}${wealth.portfolioPnLPct.toFixed(2)}%)`}
                  color={wealth.portfolioPnL >= 0 ? Colors.success : Colors.danger}
                  bgColor={wealth.portfolioPnL >= 0 ? Colors.successDim : Colors.dangerDim}
                />
                <Text style={styles.costBasis}>Cost: ₹{formatINR(wealth.portfolioCost)}</Text>
              </View>
            </Card>

            <SectionHeader title="Holdings" action={
              <TouchableOpacity onPress={() => setShowModal('stock')}>
                <Text style={styles.addBtn}>+ Add</Text>
              </TouchableOpacity>
            } />

            {wealth.stocks.length === 0 ? (
              <EmptyState icon="pie-chart-outline" title="No holdings" description="Add stocks manually to track your portfolio P&L" />
            ) : (
              wealth.stocks.map(stock => {
                const { value: pnl, pct } = wealth.stockPnL(stock);
                return (
                  <Card key={stock.id} style={styles.stockCard}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onLongPress={() => {
                        Alert.alert('Manage Stock', stock.name, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Update Price', onPress: () => { setPriceUpdate({ stockId: stock.id, price: String(stock.currentPrice) }); setShowModal('updatePrice'); } },
                          { text: 'Edit Info', onPress: () => startEditStock(stock) },
                          { text: 'Delete', style: 'destructive', onPress: () => wealth.deleteStock(stock.id) },
                        ]);
                      }}
                    >
                      <View style={styles.stockRow}>
                        <View>
                          <Text style={styles.stockSymbol}>{stock.symbol}</Text>
                          <Text style={styles.stockName}>{stock.name}</Text>
                          <Text style={styles.stockQty}>{stock.quantity} shares @ ₹{formatINR(stock.avgBuyPrice)}</Text>
                        </View>
                        <View style={styles.stockRight}>
                          <Text style={styles.stockCurrentPrice}>₹{formatINR(stock.currentPrice)}</Text>
                          <Badge
                            label={`${pnl >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
                            color={pnl >= 0 ? Colors.success : Colors.danger}
                            bgColor={pnl >= 0 ? Colors.successDim : Colors.dangerDim}
                          />
                        </View>
                      </View>
                      <Text style={styles.lastUpdated}>
                        Last updated: {new Date(stock.lastUpdated).toLocaleDateString('en-IN')}
                      </Text>
                    </TouchableOpacity>
                  </Card>
                );
              })
            )}
          </>
        )}

        {/* ── Goals ──────────────────────────────────────────────────────── */}
        {activeTab === 'goals' && (
          <>
            <SectionHeader title="Savings Goals" action={
              <TouchableOpacity onPress={() => setShowModal('goal')}>
                <Text style={styles.addBtn}>+ Add Goal</Text>
              </TouchableOpacity>
            } />
            {wealth.goals.length === 0 ? (
              <EmptyState icon="flag-outline" title="No goals yet" description='Create goals like "Wedding Fund" or "Property Down Payment"' />
            ) : (
              wealth.goals.map(goal => {
                const pct = wealth.goalProgress(goal);
                const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000);
                return (
                  <Card key={goal.id}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onLongPress={() => {
                        Alert.alert('Manage Goal', goal.name, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Fund Goal', onPress: () => { setGoalFund({ goalId: goal.id, amount: '', accountId: '' }); setShowModal('fundGoal'); } },
                          { text: 'Edit', onPress: () => startEditGoal(goal) },
                          { text: 'Delete', style: 'destructive', onPress: () => wealth.deleteGoal(goal.id) },
                        ]);
                      }}
                    >
                      <View style={styles.goalRow}>
                        <View style={styles.goalLeft}>
                          <Text style={styles.goalName}>{goal.name}</Text>
                          <Text style={styles.goalDays}>
                            {daysLeft > 0 ? `${daysLeft} days left` : 'Deadline passed'}
                          </Text>
                        </View>
                        <View style={styles.goalRight}>
                          <Text style={[styles.goalPct, { color: goal.color }]}>{pct.toFixed(0)}%</Text>
                        </View>
                      </View>
                      <ProgressBar pct={pct} color={goal.color} height={10} style={{ marginVertical: Spacing.sm }} />
                      <View style={styles.goalAmounts}>
                        <Text style={styles.goalSaved}>₹{formatINR(goal.currentAmount, true)} saved</Text>
                        <Text style={styles.goalTarget}>of ₹{formatINR(goal.targetAmount, true)}</Text>
                      </View>
                    </TouchableOpacity>
                  </Card>
                );
              })
            )}
          </>
        )}

        {/* ── Chitty ─────────────────────────────────────────────────────── */}
        {activeTab === 'chitty' && (
          <>
            <Card style={styles.chittyInfoCard} variant="accent">
              <Text style={styles.chittyInfoTitle}>wallet-outline What is a Chitty / Kuri?</Text>
              <Text style={styles.chittyInfoText}>
                A rotating savings scheme common in Kerala. A group contributes monthly, one member "auctions" the pot each month. The dividend is the amount below the pot value that you bid to win.
              </Text>
            </Card>
            <SectionHeader title="Your Chittys" action={
              <TouchableOpacity onPress={() => setShowModal('chitty')}>
                <Text style={styles.addBtn}>+ Add Chitty</Text>
              </TouchableOpacity>
            } />
            {wealth.chittys.length === 0 ? (
              <EmptyState icon="wallet-outline" title="No Chittys tracked" description="Add your monthly Chitty/Kuri schemes" />
            ) : (
              wealth.chittys.map(chitty => {
                const monthsElapsed = Math.floor((Date.now() - new Date(chitty.startDate).getTime()) / (30.44 * 86400000));
                const totalPaid = monthsElapsed * chitty.monthlyInstallment;
                const netCost = totalPaid - chitty.auctionDividends;
                return (
                  <Card key={chitty.id} style={styles.chittyCard}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onLongPress={() => {
                        Alert.alert('Manage Chitty', chitty.name, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Record Auction Dividend', onPress: () => { setChittyDividend({ chittyId: chitty.id, amount: '', accountId: '' }); setShowModal('chittyDividend'); } },
                          { text: 'Edit Info', onPress: () => startEditChitty(chitty) },
                          { text: 'Delete', style: 'destructive', onPress: () => wealth.deleteChitty(chitty.id) },
                        ]);
                      }}
                    >
                      <Text style={styles.chittyName}>{chitty.name}</Text>
                      <View style={styles.chittyGrid}>
                        <View style={styles.chittyItem}>
                          <Text style={styles.chittyItemLabel}>Monthly</Text>
                          <Text style={styles.chittyItemValue}>₹{formatINR(chitty.monthlyInstallment, true)}</Text>
                        </View>
                        <View style={styles.chittyItem}>
                          <Text style={styles.chittyItemLabel}>Pot Value</Text>
                          <Text style={styles.chittyItemValue}>₹{formatINR(chitty.totalValue, true)}</Text>
                        </View>
                        <View style={styles.chittyItem}>
                          <Text style={styles.chittyItemLabel}>Total Paid</Text>
                          <Text style={styles.chittyItemValue}>₹{formatINR(totalPaid, true)}</Text>
                        </View>
                        <View style={styles.chittyItem}>
                          <Text style={styles.chittyItemLabel}>Dividends</Text>
                          <Text style={[styles.chittyItemValue, { color: Colors.success }]}>₹{formatINR(chitty.auctionDividends, true)}</Text>
                        </View>
                      </View>
                      <View style={styles.chittyNetRow}>
                        <Text style={styles.chittyNetLabel}>Net Cost to You</Text>
                        <Text style={[styles.chittyNetValue, { color: netCost > 0 ? Colors.warning : Colors.success }]}>
                          ₹{formatINR(Math.abs(netCost))}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Card>
                );
              })
            )}
          </>
        )}

        {/* ── RD (Recurring Deposit) ─────────────────────────────────────── */}
        {activeTab === 'rd' && (
          <>
            <SectionHeader title="Recurring Deposits" action={
              <TouchableOpacity onPress={() => setShowModal('rd')}>
                <Text style={styles.addBtn}>+ Add RD</Text>
              </TouchableOpacity>
            } />
            {wealth.rds.length === 0 ? (
              <EmptyState icon="business-outline" title="No RDs" description="Track your bank or post office recurring deposits" />
            ) : (
              wealth.rds.map(rd => {
                const totalInvested = rd.paidInstallments * rd.monthlyInstallment;
                const progressPct = (rd.paidInstallments / rd.durationMonths) * 100;
                return (
                  <Card key={rd.id} style={styles.chittyCard}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onLongPress={() => {
                        Alert.alert('Manage RD', rd.name, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Edit Info', onPress: () => startEditRD(rd) },
                          { text: 'Delete', style: 'destructive', onPress: () => wealth.deleteRD(rd.id) },
                        ]);
                      }}
                    >
                      <View style={styles.goalRow}>
                        <View style={styles.goalLeft}>
                          <Text style={styles.goalName}>{rd.name}</Text>
                          <Text style={styles.goalDays}>
                            {rd.durationMonths - rd.paidInstallments} months remaining
                          </Text>
                        </View>
                        <View style={styles.goalRight}>
                          <Text style={[styles.goalPct, { color: Colors.primary }]}>{rd.roi}% ROI</Text>
                        </View>
                      </View>
                      <ProgressBar pct={progressPct} color={Colors.primary} height={10} style={{ marginVertical: Spacing.sm }} />
                      <View style={styles.chittyGrid}>
                        <View style={styles.chittyItem}>
                          <Text style={styles.chittyItemLabel}>Monthly</Text>
                          <Text style={styles.chittyItemValue}>₹{formatINR(rd.monthlyInstallment, true)}</Text>
                        </View>
                        <View style={styles.chittyItem}>
                          <Text style={styles.chittyItemLabel}>Total Paid</Text>
                          <Text style={styles.chittyItemValue}>₹{formatINR(totalInvested, true)}</Text>
                        </View>
                      </View>
                      {rd.accountId && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm }}>
                          <Text style={{ fontSize: 10, color: Colors.textMuted }}>Auto-debit account linked</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </Card>
                );
              })
            )}
          </>
        )}

        {/* ── Retirement ─────────────────────────────────────────────────── */}
        {activeTab === 'retirement' && (
          <>
            <Card style={styles.retCard}>
              <Text style={styles.retTitle}>🛡 Retirement Corpus Estimator</Text>
              <Text style={styles.retSub}>All calculated locally. No data leaves your device.</Text>
              <Divider style={{ marginVertical: Spacing.base }} />
              {[
                { label: 'Current Age', key: 'currentAge', keyboard: 'numeric' },
                { label: 'Target Retirement Age', key: 'retireAge', keyboard: 'numeric' },
                { label: 'Monthly SIP / Contribution (₹)', key: 'monthlyContrib', keyboard: 'decimal-pad' },
                { label: 'Expected Annual Return (%)', key: 'expectedReturn', keyboard: 'decimal-pad' },
                { label: 'Inflation Rate (%)', key: 'inflation', keyboard: 'decimal-pad' },
              ].map(({ label, key, keyboard }) => (
                <View key={key}>
                  <Text style={styles.inputLabel}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={(retForm as any)[key]}
                    onChangeText={v => setRetForm(f => ({ ...f, [key]: v }))}
                    keyboardType={(keyboard as any)}
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              ))}
              {retCorpus > 0 && (
                <Card style={styles.corpusResult} variant="accent">
                  <Text style={styles.corpusLabel}>Projected Corpus (Nominal)</Text>
                  <Text style={[styles.corpusValue, { color: Colors.success }]}>₹{formatINR(retCorpus)}</Text>
                  <Text style={styles.corpusLabel}>Inflation-Adjusted Value</Text>
                  <Text style={[styles.corpusValue, { color: Colors.warning, fontSize: FontSize.lg }]}>
                    ₹{formatINR(inflationAdjustedCorpus)}
                  </Text>
                  <Text style={styles.corpusSub}>
                    In today's money over {retYears} years at {retForm.inflation}% inflation
                  </Text>
                </Card>
              )}
            </Card>
          </>
        )}

        {/* ── Property Planner ───────────────────────────────────────────── */}
        {activeTab === 'planner' && (
          <>
            <Card style={styles.dtiCard} variant="elevated">
              <Text style={styles.dtiTitle}>🏡 Property Affordability</Text>
              <Divider style={{ marginVertical: Spacing.sm }} />
              <View style={styles.dtiRow}>
                <MetricTile
                  label="Debt-to-Income Ratio"
                  value={`${dti.toFixed(1)}%`}
                  color={affordability.color}
                />
                <Badge label={affordability.label} color={affordability.color} bgColor={`${affordability.color}22`} />
              </View>
              <ProgressBar pct={dti} color={affordability.color} height={12} style={{ marginVertical: Spacing.sm }} />
              <View style={styles.dtiThresholds}>
                <Text style={[styles.dtiThreshold, { color: Colors.success }]}>Healthy ≤35%</Text>
                <Text style={[styles.dtiThreshold, { color: Colors.warning }]}>Caution ≤50%</Text>
                <Text style={[styles.dtiThreshold, { color: Colors.danger }]}>Risk {'>'} 50%</Text>
              </View>
            </Card>

            <Card style={{ margin: Spacing.base }}>
              <Text style={styles.dtiTitle}>Max Additional EMI You Can Take</Text>
              <Text style={[styles.heroValue, { color: Colors.primary, marginTop: 4 }]}>
                ₹{formatINR(maxAdditionalEMI)}/mo
              </Text>
              <Text style={styles.retSub}>
                Based on keeping total EMIs ≤50% of monthly income (₹{formatINR(budget.monthlyIncome)})
              </Text>
            </Card>
          </>
        )}
      </ScrollView>

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {/* Add Stock */}
      <Modal visible={showModal === 'stock'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingStockId ? 'Edit Stock' : 'Add Stock Holding'}</Text>
            <TouchableOpacity onPress={() => { setShowModal(null); resetStockForm(); }}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: Spacing.base }}>
            <Text style={styles.infoNote}>⚠️ Stock prices must be updated manually (Phase 1 — no internet integration)</Text>
            {[
              { label: 'Stock Symbol *', key: 'symbol', placeholder: 'e.g. RELIANCE' },
              { label: 'Company Name', key: 'name', placeholder: 'e.g. Reliance Industries' },
              { label: 'Quantity *', key: 'quantity', placeholder: 'e.g. 10', keyboard: 'decimal-pad' },
              { label: 'Avg Buy Price (₹) *', key: 'avgBuyPrice', placeholder: '0', keyboard: 'decimal-pad' },
              { label: 'Current Price (₹)', key: 'currentPrice', placeholder: '0', keyboard: 'decimal-pad' },
            ].map(({ label, key, placeholder, keyboard }) => (
              <View key={key}>
                <Text style={styles.inputLabel}>{label}</Text>
                <TextInput style={styles.input} value={(stockForm as any)[key]} onChangeText={v => setStockForm(f => ({ ...f, [key]: v }))} placeholder={placeholder} placeholderTextColor={Colors.textMuted} keyboardType={(keyboard as any) ?? 'default'} autoCapitalize="characters" />
              </View>
            ))}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveStock}><Text style={styles.saveBtnText}>{editingStockId ? 'Update Holding' : 'Add Holding'}</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Update Price */}
      <Modal visible={showModal === 'updatePrice'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Update Current Price</Text>
            <TouchableOpacity onPress={() => setShowModal(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <View style={{ padding: Spacing.base }}>
            <Text style={styles.inputLabel}>Current Market Price (₹)</Text>
            <TextInput style={styles.input} value={priceUpdate.price} onChangeText={v => setPriceUpdate(p => ({ ...p, price: v }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" autoFocus />
            <TouchableOpacity style={styles.saveBtn} onPress={async () => { await wealth.updateStockPrice(priceUpdate.stockId, parseFloat(priceUpdate.price)); setShowModal(null); }}><Text style={styles.saveBtnText}>Update</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Goal */}
      <Modal visible={showModal === 'goal'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingGoalId ? 'Edit Goal' : 'New Savings Goal'}</Text>
            <TouchableOpacity onPress={() => { setShowModal(null); resetGoalForm(); }}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: Spacing.base }}>
            {[
              { label: 'Goal Name *', key: 'name', placeholder: 'e.g. Wedding Fund Jan 2026' },
              { label: 'Target Amount (₹) *', key: 'targetAmount', placeholder: '0', keyboard: 'decimal-pad' },
              { label: 'Target Date (YYYY-MM-DD)', key: 'targetDate', placeholder: '2026-01-01' },
            ].map(({ label, key, placeholder, keyboard }) => (
              <View key={key}>
                <Text style={styles.inputLabel}>{label}</Text>
                <TextInput style={styles.input} value={(goalForm as any)[key]} onChangeText={v => setGoalForm(f => ({ ...f, [key]: v }))} placeholder={placeholder} placeholderTextColor={Colors.textMuted} keyboardType={(keyboard as any) ?? 'default'} />
              </View>
            ))}
            <Text style={styles.inputLabel}>Color</Text>
            <View style={styles.colorRow}>
              {GOAL_COLORS.map(c => (
                <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }, goalForm.color === c && styles.colorDotActive]} onPress={() => setGoalForm(f => ({ ...f, color: c }))} />
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGoal}><Text style={styles.saveBtnText}>{editingGoalId ? 'Update Goal' : 'Create Goal'}</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Fund Goal */}
      <Modal visible={showModal === 'fundGoal'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Funds to Goal</Text>
            <TouchableOpacity onPress={() => setShowModal(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: Spacing.base }}>
            <Text style={styles.inputLabel}>Amount (₹)</Text>
            <TextInput style={styles.input} value={goalFund.amount} onChangeText={v => setGoalFund(f => ({ ...f, amount: v }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" autoFocus />
            
            <Text style={styles.inputLabel}>Source Account</Text>
            {accounts.debitAccounts.length === 0 ? (
              <Text style={{ fontSize: FontSize.sm, color: Colors.danger }}>No accounts available to transfer from.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {accounts.debitAccounts.map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.paymentChip,
                      goalFund.accountId === opt.id && styles.paymentChipActive,
                    ]}
                    onPress={() => setGoalFund(p => ({ ...p, accountId: opt.id }))}
                  >
                    <Text style={styles.paymentChipEmoji}>business-outline</Text>
                    <View>
                      <Text style={[
                        styles.paymentChipLabel,
                        goalFund.accountId === opt.id && styles.paymentChipLabelActive,
                      ]}>{opt.bankName}</Text>
                      <Text style={styles.paymentChipSub}>₹{formatINR(opt.currentBalance)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity 
              style={[styles.saveBtn, (!goalFund.accountId || !goalFund.amount) && { opacity: 0.5 }]} 
              onPress={async () => { 
                const amt = parseFloat(goalFund.amount);
                if (!amt) return;
                await wealth.fundGoal(goalFund.goalId, amt);
                await budget.addTransaction({
                  accountId: goalFund.accountId,
                  amount: -amt,
                  category: 'savings',
                  subCategory: 'Goal Funding',
                  date: new Date(),
                  note: `Transferred to Goal`
                });
                setShowModal(null); 
              }}
              disabled={!goalFund.accountId || !goalFund.amount}
            >
              <Text style={styles.saveBtnText}>Add Funds & Deduct</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Record Chitty Dividend */}
      <Modal visible={showModal === 'chittyDividend'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Record Auction Dividend</Text>
            <TouchableOpacity onPress={() => setShowModal(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: Spacing.base }}>
            <Text style={styles.inputLabel}>Dividend Amount Received (₹)</Text>
            <TextInput style={styles.input} value={chittyDividend.amount} onChangeText={v => setChittyDividend(f => ({ ...f, amount: v }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" autoFocus />
            
            <Text style={styles.inputLabel}>Deposit to Account</Text>
            {accounts.debitAccounts.length === 0 ? (
              <Text style={{ fontSize: FontSize.sm, color: Colors.danger }}>No accounts available to deposit to.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {accounts.debitAccounts.map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.paymentChip,
                      chittyDividend.accountId === opt.id && styles.paymentChipActive,
                    ]}
                    onPress={() => setChittyDividend(p => ({ ...p, accountId: opt.id }))}
                  >
                    <Text style={styles.paymentChipEmoji}>business-outline</Text>
                    <View>
                      <Text style={[
                        styles.paymentChipLabel,
                        chittyDividend.accountId === opt.id && styles.paymentChipLabelActive,
                      ]}>{opt.bankName}</Text>
                      <Text style={styles.paymentChipSub}>₹{formatINR(opt.currentBalance)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity 
              style={[styles.saveBtn, (!chittyDividend.accountId || !chittyDividend.amount) && { opacity: 0.5 }]} 
              onPress={async () => {
                const amt = parseFloat(chittyDividend.amount);
                if (!amt) return;
                await wealth.addAuctionDividend(chittyDividend.chittyId, amt);
                await budget.addTransaction({
                  accountId: chittyDividend.accountId,
                  amount: amt,
                  category: 'savings',
                  subCategory: 'Chitty Dividend',
                  date: new Date(),
                  note: `Dividend won`
                });
                setShowModal(null);
              }}
              disabled={!chittyDividend.accountId || !chittyDividend.amount}
            >
              <Text style={styles.saveBtnText}>Deposit Dividend</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Chitty */}
      <Modal visible={showModal === 'chitty'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingChittyId ? 'Edit Chitty' : 'New Chitty Scheme'}</Text>
            <TouchableOpacity onPress={() => { setShowModal(null); resetChittyForm(); }}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: Spacing.base }}>
            {[
              { label: 'Chitty Name *', key: 'name', placeholder: 'e.g. KSFE Chitty 2024' },
              { label: 'Monthly Installment (₹) *', key: 'monthlyInstallment', placeholder: '0', keyboard: 'decimal-pad' },
              { label: 'Total Pot Value (₹)', key: 'totalValue', placeholder: '0', keyboard: 'decimal-pad' },
              { label: 'Duration (months)', key: 'durationMonths', placeholder: '24', keyboard: 'numeric' },
              { label: 'Start Date (YYYY-MM-DD)', key: 'startDate', placeholder: '2024-01-01' },
            ].map(({ label, key, placeholder, keyboard }) => (
              <View key={key}>
                <Text style={styles.inputLabel}>{label}</Text>
                <TextInput style={styles.input} value={(chittyForm as any)[key]} onChangeText={v => setChittyForm(f => ({ ...f, [key]: v }))} placeholder={placeholder} placeholderTextColor={Colors.textMuted} keyboardType={(keyboard as any) ?? 'default'} />
              </View>
            ))}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChitty}><Text style={styles.saveBtnText}>{editingChittyId ? 'Update Chitty' : 'Add Chitty'}</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Add RD Modal */}
      <Modal visible={showModal === 'rd' || showModal === 'rd_add'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingRDId ? 'Edit RD' : 'New Recurring Deposit'}</Text>
            <TouchableOpacity onPress={() => { setShowModal(null); resetRDForm(); }}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: Spacing.base }}>
            {[
              { label: 'Deposit Name *', key: 'name', placeholder: 'e.g. SBI RD', keyboard: 'default' },
              { label: 'Monthly Installment (₹) *', key: 'monthlyInstallment', placeholder: '0', keyboard: 'decimal-pad' },
              { label: 'Duration (months) *', key: 'durationMonths', placeholder: '12', keyboard: 'numeric' },
              { label: 'Annual ROI (%)', key: 'roi', placeholder: '7.0', keyboard: 'decimal-pad' },
              { label: 'Deposit Date (1-31)', key: 'depositDay', placeholder: '1', keyboard: 'numeric' },
            ].map(({ label, key, placeholder, keyboard }) => (
              <View key={key}>
                <Text style={styles.inputLabel}>{label}</Text>
                <TextInput style={styles.input} value={(rdForm as any)[key]} onChangeText={v => setRDForm(f => ({ ...f, [key]: v }))} placeholder={placeholder} placeholderTextColor={Colors.textMuted} keyboardType={(keyboard as any)} />
              </View>
            ))}

            <Text style={styles.inputLabel}>Auto Debit Account (Optional)</Text>
            <Text style={styles.paymentHint}>Link a bank account for auto-tracking payments</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.paymentChip, !rdForm.accountId && styles.paymentChipActive]}
                onPress={() => setRDForm(f => ({ ...f, accountId: '' }))}
              >
                <Text style={styles.paymentChipEmoji}>🚫</Text>
                <View>
                  <Text style={[styles.paymentChipLabel, !rdForm.accountId && styles.paymentChipLabelActive]}>None</Text>
                  <Text style={styles.paymentChipSub}>Manual payment</Text>
                </View>
              </TouchableOpacity>
              {accounts.debitAccounts.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.paymentChip, rdForm.accountId === opt.id && styles.paymentChipActive]}
                  onPress={() => setRDForm(f => ({ ...f, accountId: opt.id }))}
                >
                  <Text style={styles.paymentChipEmoji}>business-outline</Text>
                  <View>
                    <Text style={[styles.paymentChipLabel, rdForm.accountId === opt.id && styles.paymentChipLabelActive]}>{opt.bankName}</Text>
                    <Text style={styles.paymentChipSub}>Auto deduct</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRD}><Text style={styles.saveBtnText}>{editingRDId ? 'Update RD' : 'Create RD'}</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
});

export default WealthScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  tabBar: { borderBottomWidth: 1, borderBottomColor: Colors.border, maxHeight: 52 },
  tabBarContent: { paddingHorizontal: Spacing.base, gap: Spacing.xs, alignItems: 'center' },
  tab: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: 'transparent' },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  tabTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  content: { flex: 1, paddingTop: Spacing.base },
  heroCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  heroLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.semibold, letterSpacing: 1 },
  heroValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginVertical: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroItem: { flex: 1, alignItems: 'center' },
  heroItemLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  heroItemValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginTop: 2 },
  heroSep: { width: 1, height: 32, backgroundColor: Colors.border },
  pnlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  costBasis: { fontSize: FontSize.xs, color: Colors.textMuted },
  addBtn: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  stockCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  stockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stockSymbol: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  stockName: { fontSize: FontSize.xs, color: Colors.textSecondary },
  stockQty: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  stockRight: { alignItems: 'flex-end', gap: 4 },
  stockCurrentPrice: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  updatePriceBtn: { marginTop: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary },
  updatePriceBtnText: { fontSize: FontSize.xs, color: Colors.primary },
  lastUpdated: { fontSize: 10, color: Colors.textMuted, marginTop: Spacing.xs },
  goalCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm, overflow: 'hidden' },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  goalLeft: { flex: 1 },
  goalName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  goalDays: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  goalRight: { alignItems: 'flex-end' },
  goalPct: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold },
  goalAmounts: { flexDirection: 'row', justifyContent: 'space-between' },
  goalSaved: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  goalTarget: { fontSize: FontSize.sm, color: Colors.textSecondary },
  fundBtn: { marginTop: Spacing.sm, backgroundColor: Colors.primaryDark, borderRadius: Radius.sm, padding: Spacing.sm, alignItems: 'center' },
  fundBtnText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  chittyInfoCard: { margin: Spacing.base },
  chittyInfoTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 6 },
  chittyInfoText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  chittyCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  chittyName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  chittyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  chittyItem: { flex: 1, minWidth: '40%', backgroundColor: Colors.bgElevated, borderRadius: Radius.sm, padding: Spacing.sm },
  chittyItemLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  chittyItemValue: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 2 },
  chittyNetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  chittyNetLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  chittyNetValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  dividendBtn: { marginTop: Spacing.sm, backgroundColor: Colors.successDim, borderRadius: Radius.sm, padding: Spacing.sm, alignItems: 'center' },
  dividendBtnText: { color: Colors.success, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  retCard: { margin: Spacing.base },
  retTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  retSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  corpusResult: { marginTop: Spacing.base },
  corpusLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Spacing.sm },
  corpusValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  corpusSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  dtiCard: { margin: Spacing.base },
  dtiTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 4 },
  dtiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dtiThresholds: { flexDirection: 'row', justifyContent: 'space-between' },
  dtiThreshold: { fontSize: FontSize.xs },
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  modalClose: { fontSize: FontSize.lg, color: Colors.textSecondary },
  inputLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.base, fontWeight: FontWeight.medium },
  input: { backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.base, color: Colors.textPrimary, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  infoNote: { fontSize: FontSize.xs, color: Colors.warning, backgroundColor: Colors.warningDim, borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.sm },
  colorRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: Colors.textPrimary },
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
