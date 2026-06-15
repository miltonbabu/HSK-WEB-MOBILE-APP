// Polyfill for Node < 20 (EAS build environment)
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function () {
    return [...this].reverse();
  };
}

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Limit workers to prevent OOM crashes during bundling
config.maxWorkers = 1;

module.exports = withNativeWind(config, { input: "./global.css" });
