import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores, loadAllStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../theme';
import AppIcon from '../../components/AppIcon';
import { runInAction } from 'mobx';

const PIN_LENGTH = 6;

const AuthScreen: React.FC = observer(() => {
  const { auth } = useStores();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'biometric' | 'pin'>('biometric');

  // Simple demo PIN — in production this is stored hashed in Keychain
  const DEMO_PIN = '123456';

  useEffect(() => {
    if (mode === 'biometric') {
      attemptBiometric();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attemptBiometric = async () => {
    setLoading(true);
    try {
      // react-native-biometrics integration point
      // const rnBiometrics = new ReactNativeBiometrics();
      // const { success } = await rnBiometrics.simplePrompt({ promptMessage: 'Authenticate to FinTrack' });
      // For now, auto-unlock in dev mode
      await new Promise<void>(r => setTimeout(() => r(), 800));
      await unlock();
    } catch {
      setMode('pin');
    } finally {
      setLoading(false);
    }
  };

  const unlock = async () => {
    setLoading(true);
    await loadAllStores();
    auth.setUnlocked();
    setLoading(false);
  };

  const handlePinInput = (digit: string) => {
    const next = pin + digit;
    if (next.length > PIN_LENGTH) return;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      if (next === DEMO_PIN) {
        unlock();
      } else {
        Alert.alert('Incorrect PIN', 'Please try again.');
        setPin('');
      }
    }
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  const handleSwitchProfile = () => {
    runInAction(() => {
      auth.activeProfile = null;
    });
  };

  const PadButton = ({ digit, label }: { digit: string; label?: string }) => (
    <TouchableOpacity
      style={styles.padBtn}
      onPress={() => digit === 'del' ? handleDelete() : handlePinInput(digit)}
      activeOpacity={0.7}
    >
      <Text style={styles.padText}>{label ?? digit}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Profile info area */}
      <View style={styles.header}>
        <View style={styles.profileBadge}>
          <Text style={styles.profileEmoji}>{auth.activeProfile?.emoji}</Text>
        </View>
        <Text style={styles.appName}>Welcome back,</Text>
        <Text style={styles.userName}>{auth.activeProfile?.name}</Text>
        
        <TouchableOpacity style={styles.switchBtn} onPress={handleSwitchProfile}>
          <Text style={styles.switchBtnText}>Switch Profile</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Unlocking securely…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.pinArea}>
            {/* PIN dots */}
            <View style={styles.dotsRow}>
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i < pin.length && styles.dotFilled]}
                />
              ))}
            </View>

            <Text style={styles.pinLabel}>
              {mode === 'pin' ? 'Enter your 6-digit PIN' : 'Enter PIN to continue'}
            </Text>

            {/* Number pad */}
            <View style={styles.pad}>
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <PadButton key={d} digit={d} />
              ))}
              <PadButton digit="" label="" />
              <PadButton digit="0" />
              <PadButton digit="del" label="⌫" />
            </View>

            {mode === 'pin' && (
              <TouchableOpacity style={styles.bioLink} onPress={attemptBiometric}>
                <Text style={styles.bioLinkText}>🔐 Use Biometrics</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.demoHint}>Demo PIN: 123456</Text>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
});

export default AuthScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  profileBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  profileEmoji: {
    fontSize: 32,
  },
  appName: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  switchBtn: {
    marginTop: Spacing.base,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: `${Colors.primary}22`,
  },
  switchBtnText: {
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
    fontWeight: FontWeight.bold,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: Spacing.base,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: FontSize.base,
  },
  pinArea: {
    alignItems: 'center',
    width: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.base,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.primary,
  },
  pinLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 280,
    gap: Spacing.sm,
  },
  padBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  padText: {
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  bioLink: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  bioLinkText: {
    color: Colors.primary,
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  demoHint: {
    marginTop: Spacing.lg,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
