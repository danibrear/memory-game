const STORAGE_KEY_PREFIX = "memory-game-storage";
import { storage } from "../utils/storage";

export const getStoredData = (key: string) => {
  try {
    const data = storage.getItem(`${STORAGE_KEY_PREFIX}-${key}`);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.log("[ERROR] error getting stored data for key:", key, err);
    return null;
  }
};

export const setStoredData = (key: string, data: any) => {
  try {
    storage.setItem(`${STORAGE_KEY_PREFIX}-${key}`, JSON.stringify(data));
  } catch (err) {
    console.log("[ERROR] error setting stored data for key:", key, err);
  }
};

export const clearStoredData = (key: string) => {
  try {
    storage.removeItem(`${STORAGE_KEY_PREFIX}-${key}`);
  } catch (err) {
    console.log("[ERROR] error clearing stored data for key:", key, err);
  }
};
export const clearAllStoredData = () => {
  Object.keys(storage).forEach((key) => {
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      try {
        storage.removeItem(key);
      } catch (err) {
        console.log("[ERROR] error clearing stored data for key:", key, err);
      }
    }
  });
};
