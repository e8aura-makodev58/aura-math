import React from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';
import {colors} from '../theme';

interface FocusableProps {
  focused: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  tone?: 'neutral' | 'correct' | 'incorrect';
}

/** A card whose focus ring is always visible, so the learner never has to guess where they are. */
export function Focusable({focused, children, style, tone = 'neutral'}: FocusableProps) {
  const background =
    tone === 'correct' ? colors.correctSurface : tone === 'incorrect' ? colors.incorrectSurface : colors.paper;
  return (
    <View
      style={[
        styles.base,
        {backgroundColor: focused ? colors.surface : background},
        focused ? styles.focused : null,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 3,
    borderColor: colors.line,
    borderRadius: 18,
  },
  focused: {
    borderColor: colors.focus,
    borderWidth: 8,
  },
});
