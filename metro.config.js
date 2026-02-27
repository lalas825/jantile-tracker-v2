const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Alias @powersync/react to our local shim to avoid runtime crash
// on Android with New Architecture. The original package causes
// "TypeError: undefined is not a function" when imported.
config.resolver = {
    ...config.resolver,
    extraNodeModules: {
        ...config.resolver?.extraNodeModules,
        '@powersync/react': path.resolve(__dirname, 'src/powersync/powersync-react-shim.js'),
    },
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
