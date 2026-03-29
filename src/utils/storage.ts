export const safeStorage = {
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[SafeStorage] Falha ao salvar ${key} no localStorage:`, e);
    }
  },
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[SafeStorage] Falha ao ler ${key} do localStorage:`, e);
      return null;
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[SafeStorage] Falha ao remover ${key} do localStorage:`, e);
    }
  }
};
