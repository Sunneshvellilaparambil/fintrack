import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import { useStores } from '../stores';
import { Colors, FontSize, FontWeight } from '../theme';
import Icon from 'react-native-vector-icons/Ionicons';

// Screens
import ProfileSwitcherScreen from '../screens/Profiles/ProfileSwitcherScreen';
import AuthScreen from '../screens/Auth/AuthScreen';
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import AccountsScreen from '../screens/Accounts/AccountsScreen';
import BudgetScreen from '../screens/Budget/BudgetScreen';
import PaymentsScreen from '../screens/Payments/PaymentsScreen';
import JointVentureScreen from '../screens/JointVenture/JointVentureScreen';
import WealthScreen from '../screens/Wealth/WealthScreen';
import VehicleScreen from '../screens/Vehicles/VehicleScreen';
import VehicleDetailScreen from '../screens/Vehicles/VehicleDetailScreen';
import AccountTransactionsScreen from '../screens/Accounts/AccountTransactionsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Dashboard: { active: 'home', inactive: 'home-outline' },
  Accounts:  { active: 'card', inactive: 'card-outline' },
  Budget:    { active: 'pie-chart', inactive: 'pie-chart-outline' },
  Payments:  { active: 'wallet', inactive: 'wallet-outline' },
  Joint:     { active: 'people', inactive: 'people-outline' },
  Wealth:    { active: 'trending-up', inactive: 'trending-up-outline' },
  Vehicles:  { active: 'car', inactive: 'car-outline' },
};

const MainTabs = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 32,
            borderRadius: 16,
            backgroundColor: focused ? `${Colors.primary}22` : 'transparent',
          }}>
            <Icon 
              name={TAB_ICONS[route.name]?.[focused ? 'active' : 'inactive'] ?? 'ellipse'} 
              size={20} 
              color={focused ? Colors.primaryLight : Colors.textMuted} 
            />
          </View>
        ),
        tabBarLabel: ({ focused, children }) => (
          <Text style={{
            fontSize: 10,
            color: focused ? Colors.primaryLight : Colors.textMuted,
            fontWeight: focused ? FontWeight.bold : FontWeight.regular,
            marginBottom: 2,
            letterSpacing: 0.2,
          }}>
            {children}
          </Text>
        ),
        tabBarStyle: {
          backgroundColor: Colors.bgCard,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(8, insets.bottom),
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: Colors.primaryLight,
        tabBarInactiveTintColor: Colors.textMuted,
      headerStyle: {
        backgroundColor: Colors.bg,
        borderBottomColor: Colors.border,
        borderBottomWidth: 1,
        elevation: 0,
        shadowOpacity: 0,
      },
      headerTitleStyle: {
        color: Colors.textPrimary,
        fontWeight: FontWeight.bold,
        fontSize: FontSize.md,
        letterSpacing: 0.3,
      },
      headerShadowVisible: false,
    })}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Home' }} />
    <Tab.Screen name="Accounts" component={AccountsScreen} />
    <Tab.Screen name="Budget" component={BudgetScreen} />
    <Tab.Screen name="Payments" component={PaymentsScreen} options={{ title: 'Payments', headerShown: false }} />
    <Tab.Screen name="Joint" component={JointVentureScreen} options={{ title: 'Joint' }} />
    <Tab.Screen name="Wealth" component={WealthScreen} />
    <Tab.Screen name="Vehicles" component={VehicleScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator: React.FC = observer(() => {
  const { auth } = useStores();

  useEffect(() => {
    auth.loadProfiles();
  }, [auth]);

  if (auth.loadingProfiles) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!auth.activeProfile ? (
          <Stack.Screen name="Profiles" component={ProfileSwitcherScreen} />
        ) : !auth.isUnlocked ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} options={{ headerShown: true, title: 'Vehicle Info', headerStyle: { backgroundColor: Colors.bg, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: Colors.border }, headerTintColor: Colors.textPrimary }} />
            <Stack.Screen
              name="AccountTransactions"
              component={AccountTransactionsScreen}
              options={{
                headerShown: true,
                title: 'Account activity',
                headerStyle: {
                  backgroundColor: Colors.bg,
                  elevation: 0,
                  shadowOpacity: 0,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.border,
                },
                headerTintColor: Colors.textPrimary,
                headerTitleStyle: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
});

export default AppNavigator;
