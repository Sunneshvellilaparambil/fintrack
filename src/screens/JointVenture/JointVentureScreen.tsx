import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, StatusBar,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../theme';
import { Card, GlowCard, Badge, SectionHeader, EmptyState, Divider, StatRow } from '../../components/shared';
import { formatINR } from '../../utils/finance';

const JointVentureScreen: React.FC = observer(() => {
  const { jointVenture } = useStores();
  const [showNewProject, setShowNewProject] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showContrib, setShowContrib] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '', description: '',
    selfName: 'You', selfPct: '50',
    coName: '', coPct: '50',
  });
  const [contribForm, setContribForm] = useState({
    memberId: '', amount: '', description: '', isJointEmi: false, accountId: '',
  });
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const resetProjectForm = () => {
    setEditingProjectId(null);
    setProjectForm({
      name: '', description: '', selfName: 'You', selfPct: '50', coName: '', coPct: '50',
    });
  };

  const startEditProject = (p: any) => {
    setEditingProjectId(p.id);
    const members = jointVenture.members.get(p.id) ?? [];
    const self = members.find(m => m.isSelf);
    const co = members.find(m => !m.isSelf);
    setProjectForm({
      name: p.name,
      description: p.description || '',
      selfName: self?.name || 'You',
      selfPct: String(self?.ownershipPct || '50'),
      coName: co?.name || '',
      coPct: String(co?.ownershipPct || '50'),
    });
    setShowNewProject(true);
  };

  const handleSaveProject = async () => {
    if (!projectForm.name || !projectForm.coName) {
      Alert.alert('Error', 'Project name and co-owner name required.'); return;
    }
    const selfPct = parseFloat(projectForm.selfPct);
    const coPct = parseFloat(projectForm.coPct);
    if (Math.abs(selfPct + coPct - 100) > 0.1) {
      Alert.alert('Error', 'Ownership percentages must add up to 100%.'); return;
    }

    if (editingProjectId) {
      await jointVenture.updateProject(editingProjectId, {
        name: projectForm.name,
        description: projectForm.description,
      });
    } else {
      await jointVenture.createProject({
        name: projectForm.name,
        description: projectForm.description,
        members: [
          { name: projectForm.selfName, isSelf: true, ownershipPct: selfPct },
          { name: projectForm.coName, isSelf: false, ownershipPct: coPct },
        ],
      });
    }
    setShowNewProject(false);
    resetProjectForm();
  };

  const handleAddContrib = async () => {
    if (!contribForm.memberId || !contribForm.amount || !contribForm.description) {
      Alert.alert('Error', 'All fields required.'); return;
    }
    const member = jointVenture.members.get(selectedProject || '')?.find(m => m.id === contribForm.memberId);
    
    if (member?.isSelf && !contribForm.accountId) {
      Alert.alert('Error', 'Please select which of your accounts you paid from.'); return;
    }

    if (!selectedProject) return;
    const amt = parseFloat(contribForm.amount);
    await jointVenture.addContribution({
      projectId: selectedProject,
      memberId: contribForm.memberId,
      amount: amt,
      description: contribForm.description,
      date: new Date(),
      isJointEmi: contribForm.isJointEmi,
    });

    if (member?.isSelf && contribForm.accountId) {
      const budget = useStores().budget;
      await budget.addTransaction({
        accountId: contribForm.accountId,
        amount: -amt,
        category: 'needs',
        subCategory: 'Joint Project',
        note: contribForm.description,
        date: new Date(),
        isJointExpense: true,
      });
    }

    setShowContrib(false);
    setContribForm({ memberId: '', amount: '', description: '', isJointEmi: false, accountId: '' });
  };

  const activeProject = selectedProject
    ? jointVenture.projects.find(p => p.id === selectedProject) : null;
  const activeMembers = selectedProject ? (jointVenture.members.get(selectedProject) ?? []) : [];
  const activeContribs = selectedProject ? (jointVenture.contributions.get(selectedProject) ?? []) : [];
  const settlement = selectedProject ? jointVenture.settlement(selectedProject) : null;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title="Joint Projects"
          action={
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowNewProject(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>+ New Project</Text>
            </TouchableOpacity>
          }
        />

        {jointVenture.projects.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No joint projects"
            description="Track shared assets like house construction, co-owned property, or family investments"
          />
        ) : (
          jointVenture.projects.map(p => (
            <Card key={p.id} style={styles.projectCard}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSelectedProject(p.id)}
                onLongPress={() => {
                  Alert.alert('Manage Project', p.name, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Edit Info', onPress: () => startEditProject(p) },
                    {
                      text: 'Delete', style: 'destructive', onPress: () => {
                        Alert.alert('Delete Project', 'Delete this project and all its contributions?', [
                          { text: 'No' },
                          { text: 'Yes', onPress: () => jointVenture.deleteProject(p.id) }
                        ]);
                      }
                    },
                  ]);
                }}
              >
                <View style={styles.projectHeader}>
                  <View style={styles.projectTitleRow}>
                    <View style={styles.projectIconBg}>
                      <Text style={{ fontSize: 20 }}>people-outline</Text>
                    </View>
                    <View>
                      <Text style={styles.projectName}>{p.name}</Text>
                      {p.description ? <Text style={styles.projectDesc}>{p.description}</Text> : null}
                    </View>
                  </View>
                  <Badge
                    label={p.status.toUpperCase()}
                    color={p.status === 'active' ? Colors.success : Colors.textMuted}
                    bgColor={p.status === 'active' ? Colors.successDim : Colors.bgElevated}
                  />
                </View>
              </TouchableOpacity>
            </Card>
          ))
        )}

        {/* ── Ledger Modal ──────────────────────────────── */}
        <Modal visible={!!selectedProject && !showContrib} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeProject?.name ?? ''}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedProject(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {settlement && (
              <View style={[
                styles.settlementBanner,
                { backgroundColor: settlement.delta >= 0 ? Colors.successDim : Colors.warningDim },
              ]}>
                <Text style={[
                  styles.settlementBannerText,
                  { color: settlement.delta >= 0 ? Colors.success : Colors.warning },
                ]}>
                  {settlement.settlementText}
                </Text>
              </View>
            )}
            <ScrollView style={{ padding: Spacing.base }} showsVerticalScrollIndicator={false}>
              <Text style={styles.ledgerTitle}>Contribution Ledger</Text>
              {activeContribs.length === 0 ? (
                <Text style={styles.emptyLedger}>No contributions yet</Text>
              ) : (
                activeContribs
                  .slice()
                  .sort((a, b) => +b.date - +a.date)
                  .map(c => {
                    const m = activeMembers.find(mem => mem.id === c.memberId);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        activeOpacity={0.7}
                        onLongPress={() => {
                          Alert.alert('Delete Contribution', 'Are you sure?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => jointVenture.deleteContribution(c.id) },
                          ]);
                        }}
                      >
                        <View style={styles.ledgerRow}>
                          <View style={[
                            styles.ledgerDot,
                            { backgroundColor: m?.isSelf ? Colors.primary : Colors.warning },
                          ]} />
                          <View style={styles.ledgerContent}>
                            <Text style={styles.ledgerDesc}>{c.description}</Text>
                            <Text style={styles.ledgerMeta}>
                              {m?.name ?? 'Unknown'} · {new Date(c.date).toLocaleDateString('en-IN')}
                              {c.isJointEmi ? '  🔗 Joint EMI' : ''}
                            </Text>
                          </View>
                          <Text style={[
                            styles.ledgerAmount,
                            { color: m?.isSelf ? Colors.primary : Colors.warning },
                          ]}>
                            ₹{formatINR(c.amount)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
              )}
              <TouchableOpacity
                style={[styles.saveBtn, { marginTop: Spacing.base }]}
                onPress={() => setShowContrib(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>+ Add Contribution</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* ── Add Contribution Modal ───────────────────── */}
        <Modal visible={showContrib} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Contribution</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowContrib(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: Spacing.base }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Who Paid?</Text>
              <View style={styles.typeRow}>
                {activeMembers.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.typeBtn, contribForm.memberId === m.id && styles.typeBtnActive]}
                    onPress={() => setContribForm(f => ({ ...f, memberId: m.id }))}
                  >
                    <Text style={[styles.typeBtnText, contribForm.memberId === m.id && styles.typeBtnTextActive]}>
                      {m.name} ({m.ownershipPct}%)
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Amount (₹) *</Text>
              <TextInput style={styles.input} value={contribForm.amount} onChangeText={v => setContribForm(f => ({ ...f, amount: v }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput style={styles.input} value={contribForm.description} onChangeText={v => setContribForm(f => ({ ...f, description: v }))} placeholder="e.g. Paid contractor for foundation work" placeholderTextColor={Colors.textMuted} />
              
              {activeMembers.find(m => m.id === contribForm.memberId)?.isSelf && (
                <>
                  <Text style={styles.inputLabel}>Paid from Account *</Text>
                  {useStores().accounts.accounts.length === 0 ? (
                    <Text style={{ fontSize: FontSize.sm, color: Colors.danger }}>No accounts available.</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      {useStores().accounts.accounts.map(opt => (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.paymentChip,
                            contribForm.accountId === opt.id && styles.paymentChipActive,
                          ]}
                          onPress={() => setContribForm(p => ({ ...p, accountId: opt.id }))}
                        >
                          <Text style={styles.paymentChipEmoji}>{opt.type === 'credit' ? 'card-outline' : 'business-outline'}</Text>
                          <View>
                            <Text style={[
                              styles.paymentChipLabel,
                              contribForm.accountId === opt.id && styles.paymentChipLabelActive,
                            ]}>{opt.bankName}</Text>
                            <Text style={styles.paymentChipSub}>₹{formatINR(opt.currentBalance)}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}
              <TouchableOpacity
                style={[styles.typeBtn, contribForm.isJointEmi && styles.typeBtnActive, { marginTop: Spacing.base, alignSelf: 'flex-start' }]}
                onPress={() => setContribForm(f => ({ ...f, isJointEmi: !f.isJointEmi }))}
              >
                <Text style={[styles.typeBtnText, contribForm.isJointEmi && styles.typeBtnTextActive]}>
                  🔗 Joint EMI payment
                </Text>
              </TouchableOpacity>
              {contribForm.isJointEmi && (
                <Text style={styles.jointEmiNote}>
                  Tracked as internal family debt, not a simple expense.
                </Text>
              )}
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddContrib} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>Record Contribution</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* ── New Project Modal ────────────────────────── */}
        <Modal visible={showNewProject} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProjectId ? 'Edit Project' : 'Start Joint Project'}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setShowNewProject(false); resetProjectForm(); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: Spacing.base }} showsVerticalScrollIndicator={false}>
              {[
                { label: 'Project Name *', key: 'name', placeholder: 'e.g. Guruvayur House' },
                { label: 'Description', key: 'description', placeholder: 'Optional details' },
                { label: 'Your Name', key: 'selfName', placeholder: 'You' },
                { label: 'Your Ownership %', key: 'selfPct', placeholder: '50', keyboard: 'numeric' },
                { label: "Co-owner's Name *", key: 'coName', placeholder: 'e.g. Brother' },
                { label: "Co-owner's Ownership %", key: 'coPct', placeholder: '50', keyboard: 'numeric' },
              ].map(({ label, key, placeholder, keyboard }) => (
                <View key={key}>
                  <Text style={styles.inputLabel}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={(projectForm as any)[key]}
                    onChangeText={v => setProjectForm(f => ({ ...f, [key]: v }))}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType={(keyboard as any) ?? 'default'}
                  />
                </View>
              ))}
              <Card style={{ marginTop: Spacing.base }} variant="accent">
                <Text style={{ color: Colors.textSecondary, fontSize: FontSize.xs }}>
                  ⚖️ Ownership must total 100%. Example: You 50% + Brother 50%.
                </Text>
              </Card>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProject} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>{editingProjectId ? 'Update Project' : 'Create Project'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </>
  );
});

export default JointVentureScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingTop: Spacing.lg },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  addBtnText: { color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  projectCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  projectTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  projectIconBg: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: `${Colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  projectDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  ownershipRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  ownerChip: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ownerName: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  ownerPct: { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.textPrimary, marginTop: 2 },
  spendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: Spacing.sm },
  spendLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  spendValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  contribBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  contribBtnText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  settlementBox: { borderRadius: Radius.md, padding: Spacing.sm, marginVertical: Spacing.sm },
  settlementText: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  settlementSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  viewLedger: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.sm },
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingTop: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClose: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  settlementBanner: { padding: Spacing.base, alignItems: 'center' },
  settlementBannerText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  ledgerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  emptyLedger: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  ledgerDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  ledgerContent: { flex: 1 },
  ledgerDesc: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  ledgerMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  ledgerAmount: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  inputLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.base,
    fontWeight: FontWeight.semibold,
  },
  input: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.base,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: 4 },
  typeBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  typeBtnActive: { backgroundColor: `${Colors.primary}18`, borderColor: Colors.primary },
  typeBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  typeBtnTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  jointEmiNote: { fontSize: FontSize.xs, color: Colors.warning, marginTop: 6 },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.base,
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
    ...Shadow.glow,
  },
  saveBtnText: { color: Colors.textPrimary, fontWeight: FontWeight.black, fontSize: FontSize.base },
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
