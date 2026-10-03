# nimulo. mobile (Expo / React Native)

iOS + Android app. Shares the finance logic, types, validation and demo store
with the web app by importing `../lib` (see `metro.config.js`).

```bash
npm install
npx expo start          # Expo Go (iOS 26 shows the native Liquid Glass tab bar)
npx tsc --noEmit        # typecheck
npx eas-cli build --platform ios      # store build (needs an Expo/EAS account)
npx eas-cli submit --platform ios
```

`storage.native.ts` (AsyncStorage) is picked over `storage.ts` (localStorage) on device.
`expo-doctor` flags `disableHierarchicalLookup` in `metro.config.js`; it is intentional,
so the web app's copies of React/zod in the root `node_modules` are never bundled.
