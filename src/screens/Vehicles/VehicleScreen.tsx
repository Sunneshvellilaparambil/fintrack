import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, StatusBar,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../theme';
import { Card, GlowCard, SectionHeader, EmptyState, Divider, Badge, MetricTile } from '../../components/shared';
import { formatINR } from '../../utils/finance';

const VehicleScreen: React.FC = observer(({ navigation }: any) => {
  const { vehicles, loans, accounts } = useStores();
  const [showAddModal, setShowAddModal] = useState(false);

  const [form, setForm] = useState({
    name: '', regNumber: '', odometer: '', insuranceDue: new Date().toISOString().split('T')[0], loanId: '',
    nextServiceType: 'km' as 'km' | 'date',
    nextServiceValue: '',
  });
  const [editingVehicleId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', regNumber: '', odometer: '', insuranceDue: new Date().toISOString().split('T')[0], loanId: '', nextServiceType: 'km', nextServiceValue: '' });
  };

  const startEdit = (v: any) => {
    setEditingId(v.id);
    setForm({
      name: v.name,
      regNumber: v.regNumber || '',
      odometer: String(v.odometer || '0'),
      insuranceDue: v.insuranceDue ? new Date(v.insuranceDue).toISOString().split('T')[0] : '',
      loanId: v.loanId || '',
      nextServiceType: v.nextServiceDate ? 'date' : 'km',
      nextServiceValue: v.nextServiceDate ? new Date(v.nextServiceDate).toISOString().split('T')[0] : v.nextServiceKm ? String(v.nextServiceKm) : '',
    });
    setShowAddModal(true);
  };

  const handleSaveVehicle = async () => {
    if (!form.name || !form.regNumber) { Alert.alert('Error', 'Name and Reg No required'); return; }
    const data = {
      name: form.name,
      regNumber: form.regNumber,
      odometer: parseInt(form.odometer) || 0,
      insuranceDue: new Date(form.insuranceDue),
      loanId: form.loanId || undefined,
      nextServiceDate: form.nextServiceType === 'date' && form.nextServiceValue ? new Date(form.nextServiceValue) : null,
      nextServiceKm: form.nextServiceType === 'km' && form.nextServiceValue ? parseInt(form.nextServiceValue) : null,
    };

    if (editingVehicleId) {
      await vehicles.updateVehicle(editingVehicleId, data);
    } else {
      await vehicles.addVehicle(data);
    }
    setShowAddModal(false);
    resetForm();
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <SectionHeader title="Your Garage" 
            action={<TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}><Text style={styles.addBtnText}>+ Add Vehicle</Text></TouchableOpacity>} 
          />
        </View>

        {vehicles.vehicles.length === 0 ? (
          <EmptyState icon="🚗" title="No vehicles yet" description="Add your car or bike to track maintenance costs." />
        ) : (
          vehicles.vehicles.map(v => {
            const hasInsuranceDue = v.insuranceDue && new Date(v.insuranceDue).getTime() - Date.now() < 30 * 86400000;
            const totalCost = vehicles.getTotalServiceCost(v.id);
            return (
              <TouchableOpacity 
                key={v.id} 
                activeOpacity={0.8}
                onPress={() => navigation.navigate('VehicleDetail', { vehicleId: v.id })}
                onLongPress={() => {
                  Alert.alert('Manage Vehicle', v.name, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Edit Info', onPress: () => startEdit(v) },
                    { text: 'Delete', style: 'destructive', onPress: () => vehicles.deleteVehicle(v.id) }
                  ]);
                }}
              >
                <GlowCard 
                  glowColor={Colors.bgElevated}
                  style={styles.vehicleCard}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.iconBg}><Text style={{ fontSize: 24 }}>{v.name.toLowerCase().includes('bike') ? '🏍️' : '🚗'}</Text></View>
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <Text style={styles.vName}>{v.name}</Text>
                      <Text style={styles.vReg}>{v.regNumber}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.vOdo}>{v.odometer.toLocaleString()} km</Text>
                      {hasInsuranceDue && <Badge label="Insurance ⏳" color={Colors.warning} bgColor={`${Colors.warning}18`} />}
                      {v.nextServiceKm ? (
                        <Text style={{ fontSize: FontSize.xs, color: Colors.info, marginTop: 2 }}>Next Svc: {v.nextServiceKm} km</Text>
                      ) : v.nextServiceDate ? (
                        <Text style={{ fontSize: FontSize.xs, color: Colors.info, marginTop: 2 }}>Next Svc: {new Date(v.nextServiceDate).toLocaleDateString('en-IN')}</Text>
                      ) : null}
                    </View>
                  </View>
                  <Divider style={{ marginVertical: Spacing.sm }} />
                  <View style={styles.cardStats}>
                    <MetricTile label="Maint. Cost" value={`₹${formatINR(totalCost)}`} color={Colors.info} />
                    <MetricTile label="Logs" value={String(vehicles.serviceLogsByVehicle.get(v.id)?.length || 0)} color={Colors.primaryLight} />
                  </View>
                </GlowCard>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Add/Edit Vehicle Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingVehicleId ? 'Update Vehicle' : 'New Vehicle'}</Text>
            <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }} style={styles.closeBtn}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: Spacing.base }}>
            <Text style={styles.inputLabel}>Vehicle Name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. My Creta, Duke 390" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.inputLabel}>Registration Number *</Text>
            <TextInput style={styles.input} value={form.regNumber} onChangeText={v => setForm(f => ({ ...f, regNumber: v }))} placeholder="e.g. MH 12 AB 1234" placeholderTextColor={Colors.textMuted} autoCapitalize="characters" />
            <Text style={styles.inputLabel}>Current Odometer (km)</Text>
            <TextInput style={styles.input} value={form.odometer} onChangeText={v => setForm(f => ({ ...f, odometer: v }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
            <Text style={styles.inputLabel}>Insurance Due Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={form.insuranceDue} onChangeText={v => setForm(f => ({ ...f, insuranceDue: v }))} placeholder="2024-12-31" placeholderTextColor={Colors.textMuted} />
            
            <Text style={styles.inputLabel}>Next Service Trigger</Text>
            <View style={{ flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' }}>
              <TouchableOpacity 
                style={{ flex: 1, padding: 10, alignItems: 'center', backgroundColor: form.nextServiceType === 'km' ? `${Colors.primary}20` : 'transparent' }}
                onPress={() => setForm(f => ({ ...f, nextServiceType: 'km', nextServiceValue: '' }))}
              >
                <Text style={{ color: form.nextServiceType === 'km' ? Colors.primary : Colors.textSecondary, fontWeight: 'bold' }}>By Odometer (KM)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, padding: 10, alignItems: 'center', backgroundColor: form.nextServiceType === 'date' ? `${Colors.primary}20` : 'transparent' }}
                onPress={() => setForm(f => ({ ...f, nextServiceType: 'date', nextServiceValue: '' }))}
              >
                <Text style={{ color: form.nextServiceType === 'date' ? Colors.primary : Colors.textSecondary, fontWeight: 'bold' }}>By Date</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>{form.nextServiceType === 'km' ? 'Target Odometer (km)' : 'Target Date (YYYY-MM-DD)'}</Text>
            <TextInput 
              style={styles.input} 
              value={form.nextServiceValue} 
              onChangeText={v => setForm(f => ({ ...f, nextServiceValue: v }))} 
              placeholder={form.nextServiceType === 'km' ? 'e.g. 15000' : 'e.g. 2024-12-31'} 
              placeholderTextColor={Colors.textMuted} 
              keyboardType={form.nextServiceType === 'km' ? 'numeric' : 'default'}
            />
            
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveVehicle}><Text style={styles.saveBtnText}>Save Vehicle</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

    </>
  );
});

export default VehicleScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingTop: Spacing.lg },
  header: { paddingHorizontal: Spacing.base },
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  addBtnText: { color: Colors.textPrimary, fontSize: 12, fontWeight: FontWeight.bold },
  vehicleCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  activeCard: { borderColor: Colors.primary, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBg: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  vName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  vReg: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  vOdo: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logAddBtn: { backgroundColor: `${Colors.primary}18`, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full },
  logAddText: { color: Colors.primaryLight, fontWeight: FontWeight.bold, fontSize: 12 },
  logsSection: { paddingHorizontal: Spacing.base, marginTop: Spacing.md },
  emptyLogs: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.lg },
  logRow: { flexDirection: 'row', marginBottom: Spacing.base },
  logPoint: { width: 4, backgroundColor: Colors.border, borderRadius: 2, marginRight: Spacing.base, marginTop: 8, height: '80%' },
  logContent: { flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  logTop: { flexDirection: 'row', justifyContent: 'space-between' },
  logDesc: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  logCost: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.danger },
  logMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  logDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  logOdo: { fontSize: FontSize.xs, color: Colors.textMuted },
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingTop: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 12, color: Colors.textSecondary },
  inputLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 4, marginTop: Spacing.base },
  input: { backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.base, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.xl, ...Shadow.glow },
  saveBtnText: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
});
