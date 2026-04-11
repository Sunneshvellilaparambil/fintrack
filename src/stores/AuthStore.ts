import { makeAutoObservable, runInAction } from 'mobx';

type AuthState = 'idle' | 'locked' | 'unlocked' | 'error';

export class AuthStore {
  state: AuthState = 'locked';
  error: string | null = null;
  hasBiometrics = false;

  constructor() {
    makeAutoObservable(this);
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
