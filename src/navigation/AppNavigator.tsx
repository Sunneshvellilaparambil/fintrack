import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../stores';
import { Colors, FontSize, FontWeight } from '../theme';

// Screens
import AuthScreen from '../screens/Auth/AuthScreen';
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import AccountsScreen from '../screens/Accounts/AccountsScreen';
import BudgetScreen from '../screens/Budget/BudgetScreen';
import EMIScreen from '../screens/EMI/EMIScreen';
import JointVentureScreen from '../screens/JointVenture/JointVentureScreen';
import WealthScreen from '../screens/Wealth/WealthScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Dashboard: { active: '🏦', inactive: '🏦' },
  Accounts:  { active: '💳', inactive: '💳' },
  Budget:    { active: '📊', inactive: '📊' },
  EMI:       { active: '📅', inactive: '📅' },
  Joint:     { active: '🤝', inactive: '🤝' },
  Wealth:    { active: '📈', inactive: '📈' },
};

const MainTabs = () => (
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
          <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.45 }}>
            {TAB_ICONS[route.name]?.active ?? '●'}
          </Text>
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
        height: 72,
        paddingTop: 8,
        paddingBottom: 12,
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
    <Tab.Screen name="EMI" component={EMIScreen} options={{ title: 'EMI Hub' }} />
    <Tab.Screen name="Joint" component={JointVentureScreen} options={{ title: 'Joint' }} />
    <Tab.Screen name="Wealth" component={WealthScreen} />
  </Tab.Navigator>
);

const AppNavigator: React.FC = observer(() => {
  const { auth } = useStores();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!auth.isUnlocked ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
});

export default AppNavigator;
