import { Alert, Platform, PermissionsAndroid } from 'react-native';
import RNFS from 'react-native-fs';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { database } from '../db';

// ─── All WatermelonDB table names ─────────────────────────────────────────────
const TABLES = [
  'accounts', 'transactions', 'income_sources', 'loans',
  'joint_projects', 'joint_members', 'joint_contributions',
  'stocks', 'goals', 'chittys', 'rds', 'vehicles', 'service_logs',
  'odometer_history',
];

// ─── Request Android Storage Permission ───────────────────────────────────────
async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const sdkVersion = Platform.Version as number;

  // Android 13+ (API 33+): document picker handles its own access,
  // but we still need READ_MEDIA for RNFS writes
  if (sdkVersion >= 33) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
    ]);
    return Object.values(result).every(
      v => v === PermissionsAndroid.RESULTS.GRANTED,
    );
  }

  // Android 10–12 (API 29–32)
  if (sdkVersion >= 29) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'FinTrack needs access to your storage to backup and restore data.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  // Android 9 and below
  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  ]);
  return Object.values(results).every(
    v => v === PermissionsAndroid.RESULTS.GRANTED,
  );
}

// ─── Export / Backup ──────────────────────────────────────────────────────────
export const exportData = async () => {
  try {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Denied',
        'Storage permission is required to save the backup file. Please grant it in Settings → App Permissions.',
      );
      return;
    }

    const { stores } = require('../stores') as typeof import('../stores');
    const profile = stores.auth.activeProfile;

    const backup: Record<string, any> = {
      version: 3,
      timestamp: new Date().toISOString(),
      profileId: profile?.id,
      profileName: profile?.name,
      data: {},
    };

    for (const table of TABLES) {
      const records = await database.collections.get(table).query().fetch();
      backup.data[table] = records.map(r => r._raw);
    }

    const jsonStr = JSON.stringify(backup, null, 2);
    const safeName = (profile?.name || 'User').replace(/[^a-z0-9]/gi, '_');
    const filename = `FinTrack_Backup_${safeName}_${Date.now()}.json`;
    const savePath = Platform.OS === 'android'
      ? `${RNFS.DownloadDirectoryPath}/${filename}`
      : `${RNFS.DocumentDirectoryPath}/${filename}`;

    await RNFS.writeFile(savePath, jsonStr, 'utf8');

    Alert.alert(
      '✅ Backup Successful',
      `Your data has been saved to:\n\n📁 ${savePath}\n\nYou can find it in your Downloads folder.`,
    );
  } catch (error: any) {
    console.error('[Backup] Export failed:', error);
    Alert.alert('Backup Error', error.message || 'Failed to export data. Please try again.');
  }
};

// ─── Import / Restore ─────────────────────────────────────────────────────────
export const importData = async () => {
  try {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Denied',
        'Storage permission is required to read backup files. Please grant it in Settings → App Permissions.',
      );
      return;
    }

    // Open native file picker so user can browse and select any .json file
    let pickerResult: Awaited<ReturnType<typeof pick>>;
    try {
      pickerResult = await pick({
        type: [types.json],
        allowMultiSelection: false,
        copyTo: 'cachesDirectory',
      });
    } catch (err: any) {
      if (err?.code === errorCodes.OPERATION_CANCELED) {
        return; // user cancelled — silent exit
      }
      throw err;
    }

    const selectedFile = pickerResult[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name ?? 'selected file';

    Alert.alert(
      '🔄 Restore Backup?',
      `Selected file:\n📄 ${fileName}\n\n⚠️ WARNING: This will permanently delete ALL existing data and replace it with the backup. This cannot be undone.\n\nAre you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => performRestore(selectedFile),
        },
      ],
    );
  } catch (error: any) {
    console.error('[Backup] Import failed:', error);
    Alert.alert('Import Error', error.message || 'Failed to open file picker. Please try again.');
  }
};

// ─── Core restore logic (separated for clarity) ───────────────────────────────
async function performRestore(selectedFile: any) {
  try {
    // 1. Read file content
    const rawUri: string = selectedFile.fileCopyUri ?? selectedFile.uri;
    const filePath = rawUri.startsWith('file://')
      ? rawUri.replace('file://', '')
      : rawUri;

    const fileContent = await RNFS.readFile(filePath, 'utf8');

    const { stores } = require('../stores') as typeof import('../stores');
    const currentProfile = stores.auth.activeProfile;

    // 2. Parse and validate
    let parsed: any;
    try {
      parsed = JSON.parse(fileContent);
    } catch {
      Alert.alert('Invalid File', 'The selected file is not valid JSON.');
      return;
    }

    if (!parsed?.data || parsed.version === undefined) {
      Alert.alert(
        'Invalid Backup',
        'This file does not appear to be a FinTrack backup. Please select a valid FinTrack_Backup_*.json file.',
      );
      return;
    }

    let warningMsg = `Selected file:\n📄 ${selectedFile.name ?? 'selected file'}\n\n⚠️ WARNING: This will permanently delete ALL existing data in the current profile (${currentProfile?.name}) and replace it with the backup. This cannot be undone.\n\nAre you sure?`;

    if (parsed.profileId && parsed.profileId !== currentProfile?.id) {
      warningMsg = `⚠️ PROFILE MISMATCH\n\nThis backup belongs to profile "${parsed.profileName}". You are currently restoring into "${currentProfile?.name}".\n\nThis will OVERWRITE your current profile's data. Are you absolutely sure?`;
    }

    // Wrap the rest of the restore in an Alert to confirm
    Alert.alert(
      '🔄 Restore Backup?',
      warningMsg,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              // 3. Delete all existing data in a single write transaction
              await database.write(async () => {
                for (const table of TABLES) {
                  try {
                    const existing = await database.collections.get(table).query().fetch();
                    for (const record of existing) {
                      await record.destroyPermanently();
                    }
                  } catch (e) {
                    console.warn(`[Backup] Could not clear table "${table}":`, e);
                  }
                }
              });

              // 4. Build prepareCreate list for all tables
              //    prepareCreate + batch() is the correct WatermelonDB pattern:
              //    it emits change events so MobX observables and React re-renders fire.
              const preparedRecords: any[] = [];

              for (const table of TABLES) {
                const rows: any[] = parsed.data[table];
                if (!Array.isArray(rows) || rows.length === 0) continue;

                const collection = database.collections.get(table);

                for (const raw of rows) {
                  try {
                    const prepared = collection.prepareCreate((record: any) => {
                      // *** CRITICAL: Use Object.assign to MUTATE _raw in place. ***
                      // WatermelonDB holds a reference to the original _raw object before
                      // calling this callback. Replacing `record._raw = {...}` creates a
                      // new object that WatermelonDB never sees — data silently disappears.
                      // Object.assign mutates the existing object so the reference stays valid.
                      Object.assign(record._raw, raw);
                      // Explicitly set internals after the spread
                      record._raw.id = raw.id;
                      record._raw._status = 'created';
                      record._raw._changed = '';
                    });
                    preparedRecords.push(prepared);
                  } catch (rowError) {
                    console.warn(`[Backup] Could not prepare row in "${table}":`, rowError);
                  }
                }
              }

              // 5. Commit all records atomically in one write
              if (preparedRecords.length === 0) {
                Alert.alert('No Data', 'The backup file has no records to restore.');
                return;
              }

              await database.write(async () => {
                await database.batch(...preparedRecords);
              });

              // 6. Verify the write actually landed by querying one table
              const accountsAfter = await database.collections.get('accounts').query().fetch();
              console.log(`[Backup] Verified: ${accountsAfter.length} accounts in DB after restore`);

              // 7. Reload all MobX stores so every screen refreshes immediately.
              //    Dynamic require avoids a circular import at module level while still
              //    reaching the same singleton store instances React components use.
              const { loadAllStores } = require('../stores') as typeof import('../stores');
              await loadAllStores();

              Alert.alert(
                '✅ Restore Complete',
                `Restored ${preparedRecords.length} records (${accountsAfter.length} accounts verified in DB).\n\nAll screens have been refreshed.`,
                [{ text: 'Done' }],
              );
            } catch (err: any) {
              console.error('[Backup] Restore failed:', err);
              Alert.alert(
                'Restore Error',
                err.message || 'Failed to restore data. The file may be corrupted or incompatible.',
              );
            }
          }, // end of onPress
        },
      ]
    );
  } catch (err: any) {
    console.error('[Backup] Import outer catch:', err);
  }
}
