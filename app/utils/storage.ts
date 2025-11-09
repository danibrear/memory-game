import type { TimeBack } from "~/types/Time";

export const getStoredValue = (key: string) => {
  return localStorage.getItem(key);
};
export const setStoredValue = (key: string, value: string) => {
  localStorage.setItem(key, value);
};

// Expire storage
const getExpireKey = (key: string) => `games:expires:${key}`;

export function setWithExpire(key: string, value: string, ttl: TimeBack) {
  const now = new Date();
  const ttl_ms =
    (ttl.minutes ? ttl.minutes * 60 * 1000 : 0) +
    (ttl.hours ? ttl.hours * 60 * 60 * 1000 : 0) +
    (ttl.days ? ttl.days * 24 * 60 * 60 * 1000 : 0);
  const item = {
    value: value,
    expiry: now.getTime() + ttl_ms,
  };
  localStorage.setItem(getExpireKey(key), JSON.stringify(item));
}

export const refreshWithExpire = (key: string, ttl: TimeBack) => {
  const value = getWithExpire(key);
  if (value) {
    setWithExpire(key, value, ttl);
    return value;
  }
  return null;
};

export const getWithExpire = (key: string): string | null => {
  try {
    const itemStr = localStorage.getItem(getExpireKey(key));
    if (!itemStr) {
      return null;
    }
    const item = JSON.parse(itemStr);
    const now = new Date();
    if (now.getTime() > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return item.value;
  } catch (err) {
    console.log("[ERROR] error getting item with expiry", err);
    return null;
  }
};
