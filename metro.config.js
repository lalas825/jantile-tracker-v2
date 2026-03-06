const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Force-resolve @powersync/react to our local shim to avoid runtime crash
// on Android with New Architecture. extraNodeModules is only a fallback,
// so we use resolveRequest for a hard override.
const shimPath = path.resolve(__dirname, 'src/powersync/powersync-react-shim.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === '@powersync/react') {
        return {
            filePath: shimPath,
            type: 'sourceFile',
        };
    }
    // Fall back to default resolution
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
