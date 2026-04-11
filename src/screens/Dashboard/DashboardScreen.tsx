import React from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores, loadAllStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../theme';
import { Card, GlowCard, MetricTile, ProgressBar, SectionHeader, Badge, Divider, StatRow } from '../../components/shared';
import { formatINR, creditUtilizationColor } from '../../utils/finance';

const DashboardScreen: React.FC = observer(({ navigation }: any) => {
  const { accounts, loans } = useStores();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllStores();
    setRefreshing(false);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const greetingEmoji = () => {
    const h = new Date().getHours();
    if (h < 12) return '🌅';
    if (h < 17) return '☀️';
    return '🌙';
  };

  const totalCreditUsed = accounts.creditCards.reduce(
    (sum, c) => sum + (c.currentBalance ?? 0), 0,
  );
  const totalCreditLimit = accounts.creditCards.reduce(
    (sum, c) => sum + (c.creditLimit ?? 0), 0,
  );
  const overallUtil = totalCreditLimit > 0
    ? (totalCreditUsed / totalCreditLimit) * 100 : 0;
  const overallUtilColor = creditUtilizationColor(overallUtil);

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
        {/* ── Header ──────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()} {greetingEmoji()}</Text>
            <Text style={styles.headerTitle}>Debts & Liabilities</Text>
          </View>
          <TouchableOpacity style={styles.avatarBtn} activeOpacity={0.8}>
            <Text style={styles.avatarText}>₹</Text>
          </TouchableOpacity>
        </View>

        {/* ── Total Debt Hero ──────────────────────────────── */}
        <GlowCard glowColor={Colors.warning}>
          <View style={styles.heroInner}>
            <View>
              <Text style={styles.heroLabel}>TOTAL MONTHLY DEBT</Text>
              <Text style={styles.heroValue}>
                ₹{formatINR(loans.totalMonthlyEMI + totalCreditUsed)}
              </Text>
            </View>
            <View style={[styles.debtBubble, { backgroundColor: Colors.warningDim }]}>
              <Text style={styles.debtBubbleIcon}>🏦</Text>
            </View>
          </View>
          <Divider style={{ marginVertical: Spacing.sm }} />
          <StatRow
            items={[
              {
                label: 'EMI / Month',
                value: `₹${formatINR(loans.totalMonthlyEMI, true)}`,
                color: Colors.warning,
              },
              {
                label: 'Credit Used',
                value: `₹${formatINR(totalCreditUsed, true)}`,
                color: Colors.danger,
              },
              {
                label: 'Active Loans',
                value: `${loans.loans.length}`,
                color: Colors.info,
              },
            ]}
          />
        </GlowCard>

        {/* ── EMI Due This Month ───────────────────────────── */}
        <SectionHeader
          title="EMI Due This Month"
          action={
            <TouchableOpacity
              onPress={() => navigation?.navigate?.('EMI')}
              style={styles.seeAllBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          }
        />

        {loans.loans.length === 0 ? (
          <Card style={styles.emptyEmi}>
            <Text style={styles.emptyEmiIcon}>📅</Text>
            <Text style={styles.emptyEmiText}>No active loans</Text>
            <Text style={styles.emptyEmiSub}>Add loans to track EMI dues</Text>
          </Card>
        ) : (
          loans.loans.slice(0, 3).map(loan => {
            const today = new Date();
            const nextDue = new Date(today.getFullYear(), today.getMonth(), loan.emiDay);
            if (nextDue <= today) nextDue.setMonth(nextDue.getMonth() + 1);
            const daysLeft = Math.ceil((nextDue.getTime() - today.getTime()) / 86400000);
            const isUrgent = daysLeft <= 5;
            const { formatINR: fi } = { formatINR };

            return (
              <TouchableOpacity
                key={loan.id}
                activeOpacity={0.75}
                onPress={() => navigation?.navigate?.('EMI')}
              >
                <Card style={styles.loanCard}>
                  <View style={styles.loanRow}>
                    <View style={[styles.loanIconBg, { backgroundColor: `${Colors.warning}18` }]}>
                      <Text style={styles.loanIcon}>
                        {loan.type === 'housing' ? '🏠' : loan.type === 'vehicle' ? '🚗' : '👤'}
                      </Text>
                    </View>
                    <View style={styles.loanInfo}>
                      <Text style={styles.loanName}>{loan.lender}</Text>
                      <Badge
                        label={loan.type.toUpperCase()}
                        color={Colors.warning}
                        bgColor={Colors.warningDim}
                      />
                    </View>
                    <View style={styles.loanRight}>
                      <Text style={[styles.loanEmi, { color: Colors.warning }]}>
                        ₹{formatINR(loan.emiAmount)}/mo
                      </Text>
                      <Text style={[styles.loanDue, { color: isUrgent ? Colors.danger : Colors.textMuted }]}>
                        {isUrgent ? '🔴' : '🟡'} Due in {daysLeft}d
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}

        {/* ── Credit Utilization ───────────────────────────── */}
        {accounts.creditCards.length > 0 && (
          <>
            <SectionHeader
              title="Credit Utilization"
              action={
                <TouchableOpacity
                  onPress={() => navigation?.navigate?.('Accounts')}
                  style={styles.seeAllBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeAll}>All cards →</Text>
                </TouchableOpacity>
              }
            />

            {/* Overall utilization pill */}
            <Card style={styles.utilOverallCard}>
              <View style={styles.utilOverallRow}>
                <View>
                  <Text style={styles.heroLabel}>OVERALL UTILIZATION</Text>
                  <Text style={[styles.utilPct, { color: overallUtilColor }]}>
                    {overallUtil.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.utilOverallRight}>
                  <Badge
                    label={overallUtil < 30 ? '✓ HEALTHY' : overallUtil < 50 ? '⚠ MODERATE' : '✗ HIGH'}
                    color={overallUtilColor}
                    bgColor={`${overallUtilColor}18`}
                  />
                  <Text style={styles.utilLimitText}>
                    ₹{formatINR(totalCreditUsed, true)} of ₹{formatINR(totalCreditLimit, true)}
                  </Text>
                </View>
              </View>
              <ProgressBar
                pct={overallUtil}
                color={overallUtilColor}
                height={10}
                style={{ marginTop: Spacing.sm }}
              />
            </Card>

            {accounts.creditCards.slice(0, 3).map(card => {
              const util = card.creditLimit
                ? (card.currentBalance / card.creditLimit) * 100 : 0;
              const utilColor = creditUtilizationColor(util);
              return (
                <Card key={card.id} style={styles.creditCard}>
                  <View style={styles.creditRow}>
                    <View style={[styles.creditIconBg, { backgroundColor: `${utilColor}15` }]}>
                      <Text style={styles.creditIcon}>💳</Text>
                    </View>
                    <View style={styles.creditInfo}>
                      <Text style={styles.creditName}>
                        {card.bankName} ···{card.cardLast2}
                      </Text>
                      <Badge
                        label={card.cardType?.toUpperCase() ?? 'CARD'}
                        color={Colors.textSecondary}
                        bgColor={Colors.bgElevated}
                      />
                    </View>
                    <View style={styles.creditRight}>
                      <Text style={[styles.creditUtilPct, { color: utilColor }]}>
                        {util.toFixed(0)}%
                      </Text>
                      <Text style={styles.creditLimitText}>
                        of ₹{formatINR(card.creditLimit ?? 0, true)}
                      </Text>
                    </View>
                  </View>
                  <ProgressBar
                    pct={util}
                    color={utilColor}
                    height={6}
                    style={{ marginTop: Spacing.sm }}
                  />
                </Card>
              );
            })}
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </>
  );
});

export default DashboardScreen;

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
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.glow,
  },
  avatarText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: FontWeight.black,
  },

  // Hero
  heroInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
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
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  debtBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtBubbleIcon: { fontSize: 22 },

  // EMI Cards
  emptyEmi: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyEmiIcon: { fontSize: 32, marginBottom: Spacing.sm },
  emptyEmiText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyEmiSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },

  seeAllBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: `${Colors.primary}18`,
  },
  seeAll: {
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    fontWeight: FontWeight.semibold,
  },

  loanCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  loanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loanIconBg: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanIcon: { fontSize: 20 },
  loanInfo: { flex: 1, gap: 4 },
  loanName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  loanRight: { alignItems: 'flex-end' },
  loanEmi: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  loanDue: { fontSize: FontSize.xs, marginTop: 2 },

  // Credit
  utilOverallCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  utilOverallRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  utilPct: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, letterSpacing: -0.5 },
  utilOverallRight: { alignItems: 'flex-end', gap: 6 },
  utilLimitText: { fontSize: FontSize.xs, color: Colors.textMuted },

  creditCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  creditIconBg: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditIcon: { fontSize: 18 },
  creditInfo: { flex: 1, gap: 4 },
  creditName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  creditRight: { alignItems: 'flex-end' },
  creditUtilPct: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  creditLimitText: { fontSize: FontSize.xs, color: Colors.textMuted },
});
