const STORAGE_KEY_PREFIX = "memory-game-storage";

export const getStoredData = (key: string) => {
  const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}-${key}`);
  return data ? JSON.parse(data) : null;
};

export const setStoredData = (key: string, data: any) => {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}-${key}`, JSON.stringify(data));
};

export const clearStoredData = (key: string) => {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}-${key}`);
};
export const clearAllStoredData = () => {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
};
