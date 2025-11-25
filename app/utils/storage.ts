import type { TimeBack } from "~/types/Time";
import { SSRStorage } from "../storage/ssrStorage";

const isDev = import.meta.env.DEV;

export const storage =
  typeof localStorage !== "undefined" ? localStorage : new SSRStorage();

const debug = () => {
  if (!isDev) return;
  if (typeof localStorage === "undefined") {
    console.log("Using SSRStorage");
  } else {
    console.log("Using localStorage");
  }
};
debug();

const _getItem = (key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch (err) {
    console.log("[ERROR] error getting localStorage key:", key, err);
    return null;
  }
};
const _setValue = (key: string, value: string) => {
  try {
    storage.setItem(key, value);
  } catch (err) {
    console.log("[ERROR] error setting localStorage key:", key, err);
  }
};
const _removeItem = (key: string) => {
  try {
    storage.removeItem(key);
  } catch (err) {
    console.log("[ERROR] error removing localStorage key:", key, err);
  }
};

export const getStoredValue = (key: string) => {
  try {
    return _getItem(key);
  } catch (err) {
    console.log("[ERROR] error getting localStorage key:", key, err);
    return null;
  }
};
export const setStoredValue = (key: string, value: string) => {
  try {
    _setValue(key, value);
  } catch (err) {
    console.log("[ERROR] error setting localStorage key:", key, err);
  }
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
  _setValue(getExpireKey(key), JSON.stringify(item));
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
    const itemStr = _getItem(getExpireKey(key));
    if (!itemStr) {
      return null;
    }
    const item = JSON.parse(itemStr);
    const now = new Date();
    if (now.getTime() > item.expiry) {
      _removeItem(getExpireKey(key));
      return null;
    }
    return item.value;
  } catch (err) {
    console.log("[ERROR] error getting item with expiry", err);
    return null;
  }
};
