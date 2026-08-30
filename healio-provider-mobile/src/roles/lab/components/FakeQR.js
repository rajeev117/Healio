import React, { useMemo } from 'react';
import { View } from 'react-native';
import { COLORS } from '../constants/theme';

// A lightweight, dependency-free QR-style code. It renders a deterministic
// module matrix from the given `value` with the three finder ("eye") patterns
// in the corners so it reads as a QR code. For display/demo purposes.
const MODULES = 25;

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildMatrix(value) {
  const grid = Array.from({ length: MODULES }, () => Array(MODULES).fill(false));

  let seed = hashString(value || 'x');
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let r = 0; r < MODULES; r++) {
    for (let c = 0; c < MODULES; c++) {
      grid[r][c] = rand() > 0.5;
    }
  }

  const stampFinder = (or, oc) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = or + r;
        const cc = oc + c;
        if (rr < 0 || cc < 0 || rr >= MODULES || cc >= MODULES) continue;
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const inRange = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        grid[rr][cc] = inRange ? (onBorder || inCore) : false;
      }
    }
  };
  stampFinder(0, 0);
  stampFinder(0, MODULES - 7);
  stampFinder(MODULES - 7, 0);

  return grid;
}

export default function FakeQR({ value, size = 160, color = COLORS.text, background = COLORS.white }) {
  const grid = useMemo(() => buildMatrix(value), [value]);
  const cell = size / MODULES;

  return (
    <View style={{ width: size, height: size, backgroundColor: background }}>
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', height: cell }}>
          {row.map((on, c) => (
            <View
              key={c}
              style={{ width: cell, height: cell, backgroundColor: on ? color : background }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
