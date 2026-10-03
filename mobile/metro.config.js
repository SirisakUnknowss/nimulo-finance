const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const sharedLib = path.resolve(projectRoot, "../lib");

const config = getDefaultConfig(projectRoot);

// The finance logic, types, validation and store live in ../lib and are shared
// with the web app. Resolve every bare import from this project's node_modules
// only, so the web app's React/zod copies are never pulled in (two Reacts break hooks).
config.watchFolders = [sharedLib];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
