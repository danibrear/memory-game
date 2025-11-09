import { useState } from "react";
import { getStoredValue, setStoredValue } from "./storage";

export const useLocalStorageState = <T>(key: string, initialValue: T) => {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  useState(() => {
    try {
      setIsError(false);
      const item = getStoredValue(key);
      if (item) {
        setValue(JSON.parse(item));
      } else {
        setValue(initialValue);
      }
    } catch (error) {
      console.log("[ERROR] Error reading localStorage key:", key, error);
      setValue(initialValue);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  });

  const _setValue = (value: T) => {
    try {
      setIsError(false);
      setIsLoading(false);
      setValue(value);
      if (typeof value === "string") {
        setStoredValue(key, value);
      } else {
        setStoredValue(key, JSON.stringify(value));
      }
    } catch (error) {
      console.log("[ERROR] Error setting localStorage key:", key, error);
      setIsError(true);
    }
  };

  return {
    value,
    setValue: _setValue,
    isLoading,
    isError,
  };
};
