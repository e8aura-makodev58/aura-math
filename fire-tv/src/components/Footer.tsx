import {StyleSheet, Text, View} from 'react-native';
import {colors, safe, type} from '../theme';

/** Shows which remote buttons do something on the current screen. */
export function Footer({legend}: {legend: string}) {
  return (
    <View style={styles.footer}>
      <Text style={styles.text}>{legend}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: safe.horizontal,
    paddingVertical: 24,
    borderTopWidth: 2,
    borderTopColor: colors.line,
  },
  text: {
    fontSize: type.footer,
    color: colors.quiet,
  },
});
