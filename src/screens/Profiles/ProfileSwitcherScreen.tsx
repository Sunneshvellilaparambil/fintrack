import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../theme';
import AppIcon from '../../components/AppIcon';

const EMOJIS = ['👨‍💼', '👩‍💼', '👦', '👧', '👨‍🦳', '👩‍🦳', '💼', '🏡'];

const ProfileSwitcherScreen: React.FC = observer(() => {
  const { auth } = useStores();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState(EMOJIS[0]);

  if (auth.loadingProfiles) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const handleCreate = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a name for the profile');
      return;
    }
    await auth.addProfile(newName.trim(), newEmoji);
    setIsCreating(false);
    setNewName('');
  };

  const handleSelect = async (id: string) => {
    await auth.selectProfile(id);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete Profile',
      `Are you sure you want to delete ${name}? This will permanently erase all data associated with this profile.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => auth.removeProfile(id) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppIcon size={80} />
        <Text style={styles.appName}>FinTrack</Text>
        <Text style={styles.tagline}>Who is using FinTrack?</Text>
      </View>

      {!isCreating ? (
        <View style={styles.profilesGrid}>
          {auth.profiles.map(p => (
            <TouchableOpacity 
              key={p.id} 
              style={styles.profileCard} 
              onPress={() => handleSelect(p.id)}
              onLongPress={() => handleDelete(p.id, p.name)}
            >
              <View style={styles.avatar}>
                <Text style={styles.emoji}>{p.emoji}</Text>
              </View>
              <Text style={styles.profileName} numberOfLines={1}>{p.name}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.addCard} onPress={() => setIsCreating(true)}>
            <View style={[styles.avatar, styles.addAvatar]}>
              <Text style={styles.addEmoji}>+</Text>
            </View>
            <Text style={styles.profileName}>New Profile</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.createForm}>
          <Text style={styles.formTitle}>Create Profile</Text>
          
          <View style={styles.emojiSelector}>
            {EMOJIS.map(e => (
              <TouchableOpacity 
                key={e} 
                style={[styles.emojiOption, newEmoji === e && styles.emojiSelected]}
                onPress={() => setNewEmoji(e)}
              >
                <Text style={styles.emojiOptionText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Profile Name (e.g. Suneesh)"
            placeholderTextColor={Colors.textMuted}
            value={newName}
            onChangeText={setNewName}
            autoFocus
          />

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreating(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}>
              <Text style={styles.saveBtnText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
});

export default ProfileSwitcherScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  appName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.black,
    color: Colors.textPrimary,
    marginTop: Spacing.base,
  },
  tagline: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  profilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.xl,
    maxWidth: 400,
  },
  profileCard: {
    alignItems: 'center',
    width: 100,
  },
  addCard: {
    alignItems: 'center',
    width: 100,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  addAvatar: {
    borderStyle: 'dashed',
    borderColor: Colors.textMuted,
    backgroundColor: 'transparent',
  },
  emoji: {
    fontSize: 40,
  },
  addEmoji: {
    fontSize: 32,
    color: Colors.textMuted,
  },
  profileName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  createForm: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Colors.bgCard,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.glow,
  },
  formTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  emojiSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiSelected: {
    borderColor: Colors.primary,
  },
  emojiOptionText: {
    fontSize: 24,
  },
  input: {
    backgroundColor: Colors.bgElevated,
    padding: Spacing.base,
    borderRadius: Radius.md,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  cancelBtn: {
    flex: 1,
    padding: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
  },
  cancelBtnText: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  saveBtn: {
    flex: 1,
    padding: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  saveBtnText: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
});
