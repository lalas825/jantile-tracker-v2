
import { Buffer } from 'buffer';
import 'react-native-url-polyfill/auto';

// Polyfill for both Native (global) and Web (window)
const globalObject = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {});

if (typeof globalObject.Buffer === 'undefined') {
    globalObject.Buffer = Buffer;
}
