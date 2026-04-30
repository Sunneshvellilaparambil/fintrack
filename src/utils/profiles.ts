/**
 * Profile management — stores profile list as JSON via RNFS (no extra library).
 * Each profile gets its own SQLite DB: fintrack_<id>.db
 */
import RNFS from 'react-native-fs';

const FILE = `${RNFS.DocumentDirectoryPath}/fintrack_profiles.json`;

export interface Profile {
  id: string;
  name: string;
  emoji: string;
  createdAt: number;
}

export interface ProfileRegistry {
  activeProfileId: string | null;
  profiles: Profile[];
}

export async function readRegistry(): Promise<ProfileRegistry> {
  try {
    if (!(await RNFS.exists(FILE))) return { activeProfileId: null, profiles: [] };
    return JSON.parse(await RNFS.readFile(FILE, 'utf8'));
  } catch {
    return { activeProfileId: null, profiles: [] };
  }
}

export async function writeRegistry(r: ProfileRegistry): Promise<void> {
  await RNFS.writeFile(FILE, JSON.stringify(r), 'utf8');
}

export async function createProfile(name: string, emoji: string): Promise<Profile> {
  const reg = await readRegistry();
  const p: Profile = { id: `p${Date.now()}`, name: name.trim(), emoji, createdAt: Date.now() };
  reg.profiles.push(p);
  if (!reg.activeProfileId) reg.activeProfileId = p.id;
  await writeRegistry(reg);
  return p;
}

export async function setActiveProfileId(id: string): Promise<void> {
  const reg = await readRegistry();
  reg.activeProfileId = id;
  await writeRegistry(reg);
}

export async function deleteProfileById(id: string): Promise<void> {
  const reg = await readRegistry();
  reg.profiles = reg.profiles.filter(p => p.id !== id);
  if (reg.activeProfileId === id) reg.activeProfileId = reg.profiles[0]?.id ?? null;
  await writeRegistry(reg);
  for (const ext of ['', '-wal', '-shm']) {
    const p = `${RNFS.DocumentDirectoryPath}/fintrack_${id}.db${ext}`;
    try { if (await RNFS.exists(p)) await RNFS.unlink(p); } catch {}
  }
}
