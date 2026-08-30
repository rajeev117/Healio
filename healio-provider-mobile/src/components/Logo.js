import React from 'react';
import { Image } from 'react-native';

// Native PNG export of "Healio Logo FINAL.svg" (original artwork is 424 x 391).
const logoSource = require('../../assets/healio-logo.png');

export const Logo = ({ size = 424, height, style }) => {
  const width = size;
  const svgHeight = height || (size * 391) / 424;

  return (
    <Image
      source={logoSource}
      style={[{ width, height: svgHeight }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Healio"
    />
  );
};
