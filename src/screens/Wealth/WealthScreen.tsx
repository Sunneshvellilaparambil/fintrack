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
  const [activeTab, setActiveTab] = useState<'portfolio' | 'goals' | 'chitty' | 'retirement' | 'planner'>('portfolio');
  const [showModal, setShowModal] = useState<string | null>(null);
  const [stockForm, setStockForm] = useState({ symbol: '', name: '', quantity: '', avgBuyPrice: '', currentPrice: '' });
  const [goalForm, setGoalForm] = useState({ name: '', targetAmount: '', targetDate: '', color: '#6C63FF' });
  const [chittyForm, setChittyForm] = useState({ name: '', monthlyInstallment: '', totalValue: '', durationMonths: '', startDate: new Date().toISOString().split('T')[0] });
  const [priceUpdate, setPriceUpdate] = useState({ stockId: '', price: '' });
  const [goalFund, setGoalFund] = useState({ goalId: '', amount: '' });
  // Retirement planner state
  const [retForm, setRetForm] = useState({ currentAge: '30', retireAge: '60', monthlyContrib: '', expectedReturn: '12', inflation: '6' });

  const GOAL_COLORS = ['#6C63FF', '#00D9A3', '#FFB84D', '#FF5C5C', '#4FC3F7', '#FF85A1'];

  const tabs = [
    { key: 'portfolio', label: '📈 Portfolio' },
    { key: 'goals', label: '🎯 Goals' },
    { key: 'chitty', label: '🏺 Chitty' },
    { key: 'retirement', label: '🛡 Retirement' },
    { key: 'planner', label: '🏡 Property' },
  ] as const;

  const handleAddStock = async () => {
    if (!stockForm.symbol || !stockForm.quantity || !stockForm.avgBuyPrice) {
      Alert.alert('Error', 'Symbol, quantity and avg price required'); return;
    }
    await wealth.addStock({
      symbol: stockForm.symbol.toUpperCase(),
      name: stockForm.name || stockForm.symbol.toUpperCase(),
      quantity: parseFloat(stockForm.quantity),
      avgBuyPrice: parseFloat(stockForm.avgBuyPrice),
      currentPrice: parseFloat(stockForm.currentPrice) || parseFloat(stockForm.avgBuyPrice),
    });
    setShowModal(null);
  };

  const handleAddGoal = async () => {
    if (!goalForm.name || !goalForm.targetAmount) {
      Alert.alert('Error', 'Name and target amount required'); return;
    }
    await wealth.addGoal({
      name: goalForm.name,
      targetAmount: parseFloat(goalForm.targetAmount),
      targetDate: goalForm.targetDate ? new Date(goalForm.targetDate) : new Date(Date.now() + 365 * 86400000),
      color: goalForm.color,
    });
    setShowModal(null);
  };

  const handleAddChitty = async () => {
    if (!chittyForm.name || !chittyForm.monthlyInstallment) {
      Alert.alert('Error', 'Name and monthly installment required'); return;
    }
    await wealth.addChitty({
      name: chittyForm.name,
      monthlyInstallment: parseFloat(chittyForm.monthlyInstallment),
      totalValue: parseFloat(chittyForm.totalValue) || 0,
      durationMonths: parseInt(chittyForm.durationMonths) || 12,
      startDate: new Date(chittyForm.startDate),
    });
    setShowModal(null);
  };

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
              <EmptyState icon="📊" title="No holdings" description="Add stocks manually to track your portfolio P&L" />
            ) : (
              wealth.stocks.map(stock => {
                const { value: pnl, pct } = wealth.stockPnL(stock);
                return (
                  <Card key={stock.id} style={styles.stockCard}>
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
                        <TouchableOpacity
                          style={styles.updatePriceBtn}
                          onPress={() => { setPriceUpdate({ stockId: stock.id, price: String(stock.currentPrice) }); setShowModal('updatePrice'); }}
                        >
                          <Text style={styles.updatePriceBtnText}>Update Price</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.lastUpdated}>
                      Last updated: {new Date(stock.lastUpdated).toLocaleDateString('en-IN')}
                    </Text>
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
              <EmptyState icon="🎯" title="No goals yet" description='Create goals like "Wedding Fund" or "Property Down Payment"' />
            ) : (
              wealth.goals.map(goal => {
                const pct = wealth.goalProgress(goal);
                const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000);
                return (
                  <Card key={goal.id}
                  //  style={[styles.goalCard, { borderLeftColor: goal.color, borderLeftWidth: 4 }]}
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
                    <TouchableOpacity
                      style={styles.fundBtn}
                      onPress={() => { setGoalFund({ goalId: goal.id, amount: '' }); setShowModal('fundGoal'); }}
                    >
                      <Text style={styles.fundBtnText}>+ Add Funds</Text>
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
              <Text style={styles.chittyInfoTitle}>🏺 What is a Chitty / Kuri?</Text>
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
              <EmptyState icon="🏺" title="No Chittys tracked" description="Add your monthly Chitty/Kuri schemes" />
            ) : (
              wealth.chittys.map(chitty => {
                const monthsElapsed = Math.floor((Date.now() - new Date(chitty.startDate).getTime()) / (30.44 * 86400000));
                const totalPaid = monthsElapsed * chitty.monthlyInstallment;
                const netCost = totalPaid - chitty.auctionDividends;
                return (
                  <Card key={chitty.id} style={styles.chittyCard}>
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
                    <TouchableOpacity
                      style={styles.dividendBtn}
                      onPress={() => {
                        Alert.prompt?.('Add Auction Dividend', 'Enter dividend amount you received:', (val) => {
                          if (val) wealth.addAuctionDividend(chitty.id, parseFloat(val));
                        }, 'plain-text', '', 'decimal-pad');
                      }}
                    >
                      <Text style={styles.dividendBtnText}>+ Record Auction Dividend</Text>
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
            <Text style={styles.modalTitle}>Add Stock Holding</Text>
            <TouchableOpacity onPress={() => setShowModal(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
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
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddStock}><Text style={styles.saveBtnText}>Add Holding</Text></TouchableOpacity>
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
            <Text style={styles.modalTitle}>New Savings Goal</Text>
            <TouchableOpacity onPress={() => setShowModal(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
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
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddGoal}><Text style={styles.saveBtnText}>Create Goal</Text></TouchableOpacity>
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
          <View style={{ padding: Spacing.base }}>
            <Text style={styles.inputLabel}>Amount (₹)</Text>
            <TextInput style={styles.input} value={goalFund.amount} onChangeText={v => setGoalFund(f => ({ ...f, amount: v }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" autoFocus />
            <TouchableOpacity style={styles.saveBtn} onPress={async () => { await wealth.fundGoal(goalFund.goalId, parseFloat(goalFund.amount)); setShowModal(null); }}><Text style={styles.saveBtnText}>Add Funds</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Chitty */}
      <Modal visible={showModal === 'chitty'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Chitty / Kuri</Text>
            <TouchableOpacity onPress={() => setShowModal(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
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
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddChitty}><Text style={styles.saveBtnText}>Add Chitty</Text></TouchableOpacity>
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
});
