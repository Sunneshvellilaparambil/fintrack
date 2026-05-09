import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import BillsScreen from '../Bills/BillsScreen';
import EMIScreen from '../EMI/EMIScreen';
import RDScreen from './RDScreen';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { formatINR, calculateEMI } from '../../utils/finance';
import { Card } from '../../components/shared';

type Segment = 'bills' | 'emi' | 'rd';

const PaymentsScreen: React.FC = observer(() => {
  const [active, setActive] = useState<Segment>('bills');
  const [showCommitments, setShowCommitments] = useState(true);
  const { accounts, loans, wealth } = useStores();

  // 1. Credit Card bills
  const creditCardDebt = accounts.creditCardSummaries.reduce((sum, s) => sum + s.totalOutstanding, 0);

  // 2. EMIs (exclude if the loan's accountId matches a credit card to avoid duplication)
  const nonCardLoans = loans.loans.filter(l => 
    !l.accountId || !accounts.creditCards.some(cc => cc.id === l.accountId)
  );
  const emiDebt = nonCardLoans.reduce((sum, l) => {
    if (l.paidEmis >= l.tenureMonths) return sum;
    return sum + calculateEMI(l.principal, l.roi, l.tenureMonths);
  }, 0);

  // 3. RDs (monthly saving commitments)
  const rdSavings = wealth.rds
    .filter(r => r.paidInstallments < r.durationMonths)
    .reduce((sum, r) => sum + r.monthlyInstallment, 0);

  const totalCommitment = creditCardDebt + emiDebt + rdSavings;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={{ paddingHorizontal: Spacing.base, paddingTop: Spacing.lg }}>
        <TouchableOpacity 
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}
          onPress={() => setShowCommitments(!showCommitments)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary }}>
            Monthly Commitments
          </Text>
          <Icon name={showCommitments ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        {showCommitments && (
          <Card style={{ backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, padding: Spacing.base, borderRadius: Radius.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
              <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary }}>Total Due This Month</Text>
              <Text style={{ fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.textPrimary }}>
                ₹{formatINR(totalCommitment)}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <View>
                <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>CC Bills</Text>
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.danger }}>₹{formatINR(creditCardDebt)}</Text>
              </View>
              <View>
                <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>Loans/EMI</Text>
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.warning }}>₹{formatINR(emiDebt)}</Text>
              </View>
              <View>
                <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>RD Savings</Text>
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.info }}>₹{formatINR(rdSavings)}</Text>
              </View>
            </View>
          </Card>
        )}
      </View>

      {/* ── Segment control header ─────────────────────────────── */}
      <View style={styles.segmentBar}>
        <TouchableOpacity
          style={[styles.seg, active === 'bills' && styles.segActive]}
          onPress={() => setActive('bills')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="receipt" size={16} color={active === 'bills' ? Colors.textPrimary : Colors.textMuted} />
            <Text style={[styles.segText, active === 'bills' && styles.segTextActive]}>
              Bills
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.seg, active === 'emi' && styles.segActive]}
          onPress={() => setActive('emi')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="calendar" size={16} color={active === 'emi' ? Colors.textPrimary : Colors.textMuted} />
            <Text style={[styles.segText, active === 'emi' && styles.segTextActive]}>
              EMI Loans
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.seg, active === 'rd' && styles.segActive]}
          onPress={() => setActive('rd')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="business" size={16} color={active === 'rd' ? Colors.textPrimary : Colors.textMuted} />
            <Text style={[styles.segText, active === 'rd' && styles.segTextActive]}>
              RDs
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Content ────────────────────────────────────────────── */}
      {/* Mount both screens but only show the active one so state is preserved */}
      <View style={[styles.panel, active !== 'bills' && styles.hidden]}>
        <BillsScreen />
      </View>
      <View style={[styles.panel, active !== 'emi' && styles.hidden]}>
        <EMIScreen />
      </View>
      <View style={[styles.panel, active !== 'rd' && styles.hidden]}>
        <RDScreen />
      </View>
    </View>
  );
});

export default PaymentsScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  segmentBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    marginBottom: 4,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
  },
  seg: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  segText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  segTextActive: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },

  panel: { flex: 1 },
  hidden: { display: 'none' },
});
