import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, StatusBar,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../theme';
import { Card, GlowCard, SectionHeader, EmptyState, Divider, Badge } from '../../components/shared';
import { formatINR } from '../../utils/finance';

const VehicleDetailScreen: React.FC = observer(({ route, navigation }: any) => {
  const { vehicles } = useStores();
  const vehicleId = route.params?.vehicleId;
  const vehicle = vehicles.vehicles.find(v => v.id === vehicleId);

  const [odometerInput, setOdometerInput] = useState(String(vehicle?.odometer || ''));
  const [showLogModal, setShowLogModal] = useState(false);
  const [showDuePopup, setShowDuePopup] = useState(false);
  
  const [logForm, setLogForm] = useState({
    serviceName: '', description: '', cost: '', odometer: '', date: new Date().toISOString().split('T')[0],
    isRecurring: false, recurringBy: 'km' as 'km' | 'date',
    nextServiceKm: '', nextServiceDate: '',
  });
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const logs = vehicle ? (vehicles.serviceLogsByVehicle.get(vehicle.id) ?? []) : [];
  
  // Calculate Due and Upcoming Services
  const { dueServices, upcomingServices } = useMemo(() => {
    if (!vehicle) return { dueServices: [], upcomingServices: [] };
    const dues: any[] = [];
    const upcoming: any[] = [];
    const now = new Date();
    
    // Group logs by service name to find the LATEST entry for each service
    const latestLogs = new Map<string, any>();
    
    // Sort logs descending by date, then descending by odometer
    const sortedLogs = [...logs].sort((a, b) => {
      const aTime = a.date ? (a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime()) : 0;
      const bTime = b.date ? (b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime()) : 0;
      if (bTime !== aTime) return bTime - aTime;
      return (b.odometer || 0) - (a.odometer || 0);
    });

    sortedLogs.forEach(l => {
      if (!l.isRecurring) return;
      const sName = l.serviceName || 'Unknown Service';
      if (!latestLogs.has(sName)) {
        latestLogs.set(sName, l);
      }
    });

    latestLogs.forEach(l => {
      const nsdTime = l.nextServiceDate ? (l.nextServiceDate instanceof Date ? l.nextServiceDate.getTime() : new Date(l.nextServiceDate).getTime()) : 0;
      const isDue = (l.recurringBy === 'km' && l.nextServiceKm && vehicle.odometer >= l.nextServiceKm) ||
                    (l.recurringBy === 'date' && l.nextServiceDate && now.getTime() >= nsdTime);
      if (isDue) {
        dues.push(l);
      } else {
        upcoming.push(l);
      }
    });
    return { dueServices: dues, upcomingServices: upcoming };
  }, [logs, vehicle?.odometer]);

  useEffect(() => {
    if (dueServices.length > 0) {
      setShowDuePopup(true);
    }
  }, []); // Run on load

  if (!vehicle) {
    return (
      <View style={styles.container}>
        <Text style={{ color: Colors.textPrimary, margin: 20 }}>Vehicle not found.</Text>
      </View>
    );
  }

  const handleUpdateOdometer = async () => {
    const odo = parseInt(odometerInput);
    if (!odo || odo <= vehicle.odometer) {
      Alert.alert('Error', 'Please enter a valid odometer reading higher than current.');
      return;
    }
    await vehicles.updateOdometer(vehicle.id, odo);
    Alert.alert('Success', 'Odometer updated successfully!');
    setOdometerInput(String(odo));
    
    // check if any new services became due
    // state update for vehicle.odometer triggers useMemo for dueServices
    // wait a tick for mobx
    setTimeout(() => {
      if (dueServices.length > 0) setShowDuePopup(true);
    }, 100);
  };

  const handleSaveLog = async () => {
    if (!logForm.serviceName || !logForm.cost) {
      Alert.alert('Error', 'Service Name and cost required'); return;
    }
    
    const logData = {
      serviceName: logForm.serviceName,
      description: logForm.description,
      cost: parseFloat(logForm.cost),
      odometer: parseInt(logForm.odometer) || vehicle.odometer,
      date: new Date(logForm.date),
      isRecurring: logForm.isRecurring,
      recurringBy: logForm.recurringBy,
      nextServiceKm: logForm.nextServiceKm ? parseInt(logForm.nextServiceKm) : null,
      nextServiceDate: logForm.nextServiceDate ? new Date(logForm.nextServiceDate) : null,
    };

    if (editingLogId) {
      await vehicles.updateServiceLog(editingLogId, logData);
    } else {
      await vehicles.addServiceLog({ ...logData, vehicle_id: vehicle.id } as any);
    }

    setShowLogModal(false);
    setEditingLogId(null);
    setLogForm({ 
      serviceName: '', description: '', cost: '', odometer: '', date: new Date().toISOString().split('T')[0],
      isRecurring: false, recurringBy: 'km', nextServiceKm: '', nextServiceDate: ''
    });
  };

  const startEditLog = (log: any) => {
    setEditingLogId(log.id);
    setLogForm({
      serviceName: log.serviceName || '',
      description: log.description || '',
      cost: String(log.cost || 0),
      odometer: String(log.odometer || ''),
      date: log.date ? new Date(log.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      isRecurring: !!log.isRecurring,
      recurringBy: log.recurringBy || 'km',
      nextServiceKm: log.nextServiceKm ? String(log.nextServiceKm) : '',
      nextServiceDate: log.nextServiceDate ? new Date(log.nextServiceDate).toISOString().split('T')[0] : '',
    });
    setShowLogModal(true);
  };

  const handleMarkDone = (l: any) => {
    setShowDuePopup(false);
    setLogForm({
      serviceName: l.serviceName,
      description: l.description || '',
      cost: String(l.cost),
      odometer: String(vehicle?.odometer || ''),
      date: new Date().toISOString().split('T')[0],
      isRecurring: l.isRecurring,
      recurringBy: l.recurringBy || 'km',
      nextServiceKm: '',
      nextServiceDate: '',
    });
    setShowLogModal(true);
  };

  const estimatedDueCost = dueServices.reduce((sum, l) => sum + l.cost, 0);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Top Section — Odometer Update */}
        <Card style={styles.odoCard}>
          <Text style={styles.odoTitle}>Update Odometer</Text>
          <Text style={styles.currentOdo}>Current: {vehicle.odometer.toLocaleString()} km</Text>
          
          <View style={styles.odoInputRow}>
            <TextInput 
              style={[styles.input, { flex: 1, marginBottom: 0 }]} 
              value={odometerInput} 
              onChangeText={setOdometerInput} 
              placeholder="New reading (km)" 
              placeholderTextColor={Colors.textMuted} 
              keyboardType="numeric" 
            />
            <TouchableOpacity style={styles.updateBtn} onPress={handleUpdateOdometer}>
              <Text style={styles.updateBtnText}>Update</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Middle Section — Maintenance Schedule */}
        {(dueServices.length > 0 || upcomingServices.length > 0) && (
          <View style={{ marginHorizontal: Spacing.base, marginBottom: Spacing.lg }}>
            <SectionHeader title="🚨 Maintenance Schedule" />
            
            {/* Due Services */}
            {dueServices.map(l => (
              <GlowCard key={`due-${l.id}`} glowColor={Colors.danger} style={{ marginBottom: Spacing.sm, borderColor: Colors.danger, borderWidth: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: Colors.danger, fontWeight: FontWeight.bold, fontSize: FontSize.md }}>
                      🔧 {l.serviceName}
                    </Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 4 }}>
                      Due: {l.recurringBy === 'km' ? `${l.nextServiceKm?.toLocaleString()} km` : new Date(l.nextServiceDate).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>Last paid</Text>
                    <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.bold }}>₹{formatINR(l.cost)}</Text>
                    <TouchableOpacity 
                      style={{ marginTop: 8, backgroundColor: Colors.danger, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}
                      onPress={() => handleMarkDone(l)}
                    >
                      <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>Mark Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </GlowCard>
            ))}

            {/* Upcoming Services */}
            {upcomingServices.map(l => (
              <GlowCard key={`upcoming-${l.id}`} glowColor={Colors.bgElevated} style={{ marginBottom: Spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.md }}>
                      ⏳ {l.serviceName}
                    </Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 4 }}>
                      Next: {l.recurringBy === 'km' ? `${l.nextServiceKm?.toLocaleString()} km` : new Date(l.nextServiceDate).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>Last paid</Text>
                    <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.bold }}>₹{formatINR(l.cost)}</Text>
                  </View>
                </View>
              </GlowCard>
            ))}
          </View>
        )}

        {/* Logs Section */}
        <View style={styles.logsSection}>
          <SectionHeader 
            title="Service History" 
            action={
              <TouchableOpacity style={styles.addBtn} onPress={() => { setLogForm(f => ({...f, odometer: String(vehicle.odometer)})); setShowLogModal(true); }}>
                <Text style={styles.addBtnText}>+ Add Log</Text>
              </TouchableOpacity>
            }
          />
          {logs.length === 0 ? (
            <EmptyState icon="📋" title="No logs yet" description="Record maintenance to track costs and recurrence." />
          ) : (
            logs.slice().sort((a,b) => b.date.getTime() - a.date.getTime()).map(log => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logPoint} />
                <View style={styles.logContent}>
                  <View style={styles.logTop}>
                    <Text style={styles.logDesc}>{log.serviceName} {log.description ? `(${log.description})` : ''}</Text>
                    <Text style={styles.logCost}>-₹{formatINR(log.cost)}</Text>
                  </View>
                  <View style={styles.logMeta}>
                    <Text style={styles.logDate}>{new Date(log.date).toLocaleDateString('en-IN')} · {log.odometer.toLocaleString()} km</Text>
                    {log.isRecurring && (
                      <Badge label={`🔁 Next: ${log.recurringBy === 'km' ? log.nextServiceKm + 'km' : new Date(log.nextServiceDate).toLocaleDateString('en-IN')}`} color={Colors.info} bgColor={`${Colors.info}18`} />
                    )}
                    <TouchableOpacity onPress={() => startEditLog(log)} style={{ marginLeft: 'auto', marginRight: Spacing.sm }}>
                      <Text style={{ fontSize: 10, color: Colors.primary }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => vehicles.deleteServiceLog(log.id)}>
                      <Text style={{ fontSize: 10, color: Colors.danger }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Popup Alert for Services Due */}
      <Modal visible={showDuePopup} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.popup}>
            <View style={{ alignItems: 'center', marginBottom: Spacing.md }}>
              <Text style={{ fontSize: 32 }}>⚠️</Text>
              <Text style={styles.popupTitle}>Services Due!</Text>
            </View>
            
            <View style={styles.popupBox}>
              {dueServices.map(l => (
                <View key={`popup-${l.id}`} style={{ marginBottom: Spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.bold }}>🔧 {l.serviceName}</Text>
                    <Text style={{ color: Colors.danger, fontWeight: FontWeight.bold }}>
                      {l.recurringBy === 'km' ? `At ${l.nextServiceKm?.toLocaleString()} km` : `On ${new Date(l.nextServiceDate).toLocaleDateString('en-IN')}`}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ color: Colors.textSecondary, fontSize: FontSize.xs }}>Last amount paid: ₹{formatINR(l.cost)}</Text>
                    <TouchableOpacity 
                      style={{ backgroundColor: Colors.danger, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}
                      onPress={() => handleMarkDone(l)}
                    >
                      <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>Mark Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <Divider style={{ marginVertical: Spacing.sm }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.bold }}>Estimated Total:</Text>
                <Text style={{ color: Colors.warning, fontWeight: FontWeight.black }}>~₹{formatINR(estimatedDueCost)}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.base, marginTop: Spacing.lg }}>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: Colors.bgElevated, marginTop: 0, shadowOpacity: 0 }]} onPress={() => setShowDuePopup(false)}>
                <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.bold }}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1, marginTop: 0 }]} onPress={() => setShowDuePopup(false)}>
                <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.bold }}>View Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Log Modal */}
      <Modal visible={showLogModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingLogId ? 'Edit Service Entry' : 'Service Entry'}</Text>
            <TouchableOpacity onPress={() => { setShowLogModal(false); setEditingLogId(null); }} style={styles.closeBtn}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: Spacing.base }} showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Service Name *</Text>
            <TextInput style={styles.input} value={logForm.serviceName} onChangeText={v => setLogForm(f => ({ ...f, serviceName: v }))} placeholder="e.g. Oil Change, Tyre Rotation" placeholderTextColor={Colors.textMuted} />
            
            <Text style={styles.inputLabel}>Date Performed *</Text>
            <TextInput style={styles.input} value={logForm.date} onChangeText={v => setLogForm(f => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
            
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Odometer (km)</Text>
                <TextInput style={styles.input} value={logForm.odometer} onChangeText={v => setLogForm(f => ({ ...f, odometer: v }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Amount Paid (₹) *</Text>
                <TextInput style={styles.input} value={logForm.cost} onChangeText={v => setLogForm(f => ({ ...f, cost: v }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput style={styles.input} value={logForm.description} onChangeText={v => setLogForm(f => ({ ...f, description: v }))} placeholder="Additional details" placeholderTextColor={Colors.textMuted} />
            
            <Divider style={{ marginVertical: Spacing.lg }} />
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold }}>Is Recurring?</Text>
              <TouchableOpacity 
                style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: logForm.isRecurring ? Colors.primary : Colors.bgElevated, justifyContent: 'center', padding: 2 }}
                onPress={() => setLogForm(f => ({...f, isRecurring: !f.isRecurring}))}
              >
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF', alignSelf: logForm.isRecurring ? 'flex-end' : 'flex-start' }} />
              </TouchableOpacity>
            </View>

            {logForm.isRecurring && (
              <View style={{ marginTop: Spacing.base, padding: Spacing.base, backgroundColor: Colors.bgElevated, borderRadius: Radius.md }}>
                <Text style={styles.inputLabel}>Recurring By</Text>
                <View style={{ flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: Spacing.sm }}>
                  <TouchableOpacity 
                    style={{ flex: 1, padding: 10, alignItems: 'center', backgroundColor: logForm.recurringBy === 'km' ? `${Colors.primary}20` : 'transparent' }}
                    onPress={() => setLogForm(f => ({ ...f, recurringBy: 'km', nextServiceDate: '' }))}
                  >
                    <Text style={{ color: logForm.recurringBy === 'km' ? Colors.primary : Colors.textSecondary, fontWeight: 'bold' }}>KM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ flex: 1, padding: 10, alignItems: 'center', backgroundColor: logForm.recurringBy === 'date' ? `${Colors.primary}20` : 'transparent' }}
                    onPress={() => setLogForm(f => ({ ...f, recurringBy: 'date', nextServiceKm: '' }))}
                  >
                    <Text style={{ color: logForm.recurringBy === 'date' ? Colors.primary : Colors.textSecondary, fontWeight: 'bold' }}>Date</Text>
                  </TouchableOpacity>
                </View>

                {logForm.recurringBy === 'km' ? (
                  <>
                    <Text style={styles.inputLabel}>Next Service KM</Text>
                    <TextInput style={styles.input} value={logForm.nextServiceKm} onChangeText={v => setLogForm(f => ({ ...f, nextServiceKm: v }))} placeholder="e.g. 55000 (Leave empty to auto-calc)" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
                  </>
                ) : (
                  <>
                    <Text style={styles.inputLabel}>Next Service Date</Text>
                    <TextInput style={styles.input} value={logForm.nextServiceDate} onChangeText={v => setLogForm(f => ({ ...f, nextServiceDate: v }))} placeholder="YYYY-MM-DD (Leave empty to auto-calc)" placeholderTextColor={Colors.textMuted} />
                  </>
                )}
                <Text style={{ color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 8 }}>
                  Tip: If you leave Next Service empty, Fintrack will automatically calculate it based on your last service interval for this name.
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveLog}><Text style={styles.saveBtnText}>Save Log Entry</Text></TouchableOpacity>
            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      </Modal>

    </>
  );
});

export default VehicleDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingTop: Spacing.lg },
  odoCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.xl },
  odoTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  currentOdo: { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.primary, marginVertical: Spacing.sm },
  odoInputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  updateBtn: { backgroundColor: Colors.primary, paddingHorizontal: 20, height: 48, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  updateBtnText: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  addBtnText: { color: Colors.textPrimary, fontSize: 12, fontWeight: FontWeight.bold },
  logsSection: { paddingHorizontal: Spacing.base },
  emptyLogs: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.lg },
  logRow: { flexDirection: 'row', marginBottom: Spacing.base },
  logPoint: { width: 4, backgroundColor: Colors.border, borderRadius: 2, marginRight: Spacing.base, marginTop: 8, height: '80%' },
  logContent: { flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logDesc: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  logCost: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.danger },
  logMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' },
  logDate: { fontSize: FontSize.xs, color: Colors.textSecondary },
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingTop: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 12, color: Colors.textSecondary },
  inputLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 4, marginTop: Spacing.base },
  input: { backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.base, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.xl, ...Shadow.glow },
  saveBtnText: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: Spacing.base },
  popup: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.glow },
  popupTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.textPrimary },
  popupBox: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.base },
});
