import { Alert, Share, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { database } from '../db';

const TABLES = [
  'accounts', 'transactions', 'income_sources', 'loans', 
  'joint_projects', 'joint_members', 'joint_contributions',
  'stocks', 'goals', 'chittys', 'vehicles', 'service_logs'
];

export const exportData = async () => {
  try {
    const backup: Record<string, any> = {
      version: 3,
      timestamp: new Date().toISOString(),
      data: {}
    };

    for (const table of TABLES) {
      const records = await database.collections.get(table).query().fetch();
      // Use _raw to get the plain JSON of the watermelon model
      backup.data[table] = records.map(r => r._raw);
    }

    const jsonStr = JSON.stringify(backup, null, 2);

    const path = Platform.OS === 'android' 
      ? `${RNFS.DownloadDirectoryPath}/FinTrack_Backup_${Date.now()}.json`
      : `${RNFS.DocumentDirectoryPath}/FinTrack_Backup_${Date.now()}.json`;

    await RNFS.writeFile(path, jsonStr, 'utf8');

    Alert.alert(
      'Backup Successful', 
      `Your data has been backed up successfully to:\n\n${path}`
    );
  } catch (error: any) {
    console.error('Backup failed:', error);
    Alert.alert('Backup Error', error.message || 'Failed to export data');
  }
};

export const importData = async () => {
  try {
    // For simplicity without using document picker (since it requires native module installation),
    // we try to look for the most recent backup file in the directory.
    let dirPath = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
    
    const files = await RNFS.readDir(dirPath);
    const backupFiles = files
      .filter(f => f.name.startsWith('FinTrack_Backup_') && f.name.endsWith('.json'))
      .sort((a, b) => (b.mtime?.getTime() ?? 0) - (a.mtime?.getTime() ?? 0));

    if (backupFiles.length === 0) {
      Alert.alert('No Backup Found', `Could not find any files starting with "FinTrack_Backup_" in your ${Platform.OS === 'android' ? 'Downloads' : 'Documents'} folder.`);
      return;
    }

    const latestBackup = backupFiles[0];

    Alert.alert(
      'Restore Backup?',
      `Found backup file:\n${latestBackup.name}\n\nWARNING: Restoring will overwrite all existing data. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Restore', 
          style: 'destructive',
          onPress: async () => {
            try {
              const fileContent = await RNFS.readFile(latestBackup.path, 'utf8');
              const parsed = JSON.parse(fileContent);
              
              if (!parsed.data || parsed.version === undefined) {
                Alert.alert('Invalid Backup', 'The backup file is corrupt or invalid.');
                return;
              }

              await database.write(async () => {
                // Delete existing data
                for (const table of TABLES) {
                  const existing = await database.collections.get(table).query().fetch();
                  for (const record of existing) {
                    await record.destroyPermanently();
                  }
                }

                // Insert new data
                for (const table of TABLES) {
                  if (parsed.data[table] && Array.isArray(parsed.data[table])) {
                    const collection = database.collections.get(table);
                    for (const raw of parsed.data[table]) {
                      await collection.create((record: any) => {
                        record._raw = { ...raw, id: raw.id || record.id };
                      });
                    }
                  }
                }
              });

              Alert.alert('Success', 'Data restored successfully. Please pull to refresh or restart the app.');
            } catch (err: any) {
              console.error('Import process failed:', err);
              Alert.alert('Import Error', err.message || 'Failed to restore data');
            }
          }
        }
      ]
    );

  } catch (error: any) {
    console.error('Import failed:', error);
    Alert.alert('Import Error', error.message || 'Failed to locate data');
  }
};
