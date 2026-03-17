import React, { useRef, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';

interface SignatureCanvasProps {
  onSignature: (dataUrl: string) => void;
  onClear: () => void;
  width?: number;
  height?: number;
  disabled?: boolean;
}

const SIGNATURE_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; overflow: hidden; touch-action: none; }
  canvas { display: block; width: 100%; height: 100%; }
  #placeholder {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    color: #9ca3af; font-size: 16px; font-family: sans-serif;
    pointer-events: none; user-select: none;
  }
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="placeholder">Sign here</div>
<script>
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var placeholder = document.getElementById('placeholder');
  var drawing = false;
  var hasStrokes = false;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  resize();

  function getPos(e) {
    var t = e.touches ? e.touches[0] : e;
    var r = canvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault(); drawing = true;
    var p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }, { passive: false });

  canvas.addEventListener('touchmove', function(e) {
    if (!drawing) return; e.preventDefault();
    var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
    if (!hasStrokes) { hasStrokes = true; placeholder.style.display = 'none'; }
  }, { passive: false });

  canvas.addEventListener('touchend', function() { drawing = false; });

  canvas.addEventListener('mousedown', function(e) {
    drawing = true;
    var p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener('mousemove', function(e) {
    if (!drawing) return;
    var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
    if (!hasStrokes) { hasStrokes = true; placeholder.style.display = 'none'; }
  });
  canvas.addEventListener('mouseup', function() { drawing = false; });

  window.clear = function() {
    resize(); hasStrokes = false;
    placeholder.style.display = 'block';
  };

  window.done = function() {
    if (!hasStrokes) return;
    var data = canvas.toDataURL('image/png');
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signature', data: data }));
  };

  window.checkStrokes = function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'hasStrokes', value: hasStrokes }));
  };
</script>
</body>
</html>
`;

export default function SignatureCanvas({
  onSignature,
  onClear,
  height = 200,
  disabled = false,
}: SignatureCanvasProps) {
  const webViewRef = useRef<WebView>(null);
  const [hasStrokes, setHasStrokes] = useState(false);
  const { width: screenWidth } = useWindowDimensions();

  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'signature') {
        onSignature(msg.data);
      } else if (msg.type === 'hasStrokes') {
        setHasStrokes(msg.value);
      }
    } catch { /* ignore parse errors */ }
  }, [onSignature]);

  const handleClear = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.clear(); true;');
    setHasStrokes(false);
    onClear();
  }, [onClear]);

  const handleDone = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.done(); true;');
  }, []);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.canvasContainer, { height }, disabled && styles.disabled]}>
        <WebView
          ref={webViewRef}
          source={{ html: SIGNATURE_HTML }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          scrollEnabled={false}
          bounces={false}
          onMessage={handleMessage}
          javaScriptEnabled
          onTouchStart={() => {
            // Check strokes state after a short delay
            setTimeout(() => {
              webViewRef.current?.injectJavaScript('window.checkStrokes(); true;');
            }, 300);
          }}
        />
      </View>

      <Text style={styles.helperText}>Draw your signature above</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={handleClear}
          disabled={disabled}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.doneButton, disabled && styles.disabledButton]}
          onPress={handleDone}
          disabled={disabled}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  canvasContainer: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  disabled: {
    opacity: 0.5,
  },
  helperText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  clearButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },
  doneButton: {
    backgroundColor: '#2563eb',
  },
  doneButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.4,
  },
});
