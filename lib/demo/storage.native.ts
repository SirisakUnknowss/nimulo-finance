import AsyncStorage from "@react-native-async-storage/async-storage";

export const storage = {
  getItem: (key: string) => AsyncStorage.getItem(key).catch(() => null),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value).catch(() => {}),
  removeItem: (key: string) => AsyncStorage.removeItem(key).catch(() => {}),
};
