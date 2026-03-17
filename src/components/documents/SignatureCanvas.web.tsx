import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface SignatureCanvasProps {
  onSignature: (dataUrl: string) => void;
  onClear: () => void;
  width?: number;
  height?: number;
  disabled?: boolean;
}

export default function SignatureCanvas({
  onSignature,
  onClear,
  height = 200,
  disabled = false,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawing = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(400);

  // Resize observer for responsive width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setCanvasWidth(w);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Init canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [canvasWidth, height]);

  const getPos = useCallback((e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // Pointer event handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      isDrawing.current = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      if (!hasStrokes) setHasStrokes(true);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isDrawing.current) {
        isDrawing.current = false;
        canvas.releasePointerCapture(e.pointerId);
        if (!hasStrokes) setHasStrokes(true);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
    };
  }, [canvasWidth, height, disabled, getPos, hasStrokes]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasStrokes(false);
    onClear();
  }, [onClear]);

  const handleDone = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSignature(dataUrl);
  }, [hasStrokes, onSignature]);

  return (
    <View style={styles.wrapper}>
      <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={height}
          style={{
            width: '100%',
            height,
            border: '2px dashed #d1d5db',
            borderRadius: 8,
            backgroundColor: '#ffffff',
            touchAction: 'none',
            cursor: disabled ? 'not-allowed' : 'crosshair',
            opacity: disabled ? 0.5 : 1,
          }}
        />
        {!hasStrokes && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#9ca3af',
              fontSize: 16,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            Sign here
          </div>
        )}
      </div>

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
          style={[styles.button, styles.doneButton, (!hasStrokes || disabled) && styles.disabledButton]}
          onPress={handleDone}
          disabled={!hasStrokes || disabled}
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
