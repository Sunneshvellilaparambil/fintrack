import { makeAutoObservable, runInAction } from 'mobx';
import { readRegistry, Profile, createProfile, setActiveProfileId, deleteProfileById } from '../utils/profiles';
import { initDB } from '../db';

type AuthState = 'idle' | 'locked' | 'unlocked' | 'error';

export class AuthStore {
  state: AuthState = 'locked';
  error: string | null = null;
  hasBiometrics = false;
  
  profiles: Profile[] = [];
  activeProfile: Profile | null = null;
  loadingProfiles = true;

  constructor() {
    makeAutoObservable(this);
  }

  async loadProfiles() {
    runInAction(() => { this.loadingProfiles = true; });
    const reg = await readRegistry();
    runInAction(() => {
      this.profiles = reg.profiles;
      this.activeProfile = reg.profiles.find(p => p.id === reg.activeProfileId) || null;
      this.loadingProfiles = false;
    });
    if (this.activeProfile) {
      initDB(this.activeProfile.id);
    }
  }

  async selectProfile(id: string) {
    await setActiveProfileId(id);
    const reg = await readRegistry();
    runInAction(() => {
      this.profiles = reg.profiles;
      this.activeProfile = reg.profiles.find(p => p.id === reg.activeProfileId) || null;
      this.state = 'locked'; // Re-lock when switching profile
    });
    if (this.activeProfile) {
      initDB(this.activeProfile.id);
    }
  }

  async addProfile(name: string, emoji: string) {
    const p = await createProfile(name, emoji);
    await this.selectProfile(p.id);
  }

  async removeProfile(id: string) {
    await deleteProfileById(id);
    await this.loadProfiles();
  }

  setUnlocked() {
    runInAction(() => {
      this.state = 'unlocked';
      this.error = null;
    });
  }

  setLocked() {
    runInAction(() => {
      this.state = 'locked';
    });
  }

  setError(msg: string) {
    runInAction(() => {
      this.state = 'error';
      this.error = msg;
    });
  }

  setHasBiometrics(val: boolean) {
    runInAction(() => { this.hasBiometrics = val; });
  }

  get isUnlocked() { return this.state === 'unlocked'; }
}
