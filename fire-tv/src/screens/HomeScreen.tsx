import {StyleSheet, Text, View} from 'react-native';
import {Focusable} from '../components/Focusable';
import {Footer} from '../components/Footer';
import {colors, safe, type} from '../theme';

export function HomeScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.hero}>Aura Math</Text>
        <Text style={styles.tagline}>Little steps, bright ideas</Text>
        <Text style={styles.lead}>
          Learn together on the big screen. Pick a topic, read the question, then choose your answer with the
          remote.
        </Text>
        <Focusable focused style={styles.start}>
          <Text style={styles.startText}>Start learning</Text>
        </Focusable>
        <Text style={styles.draft}>
          Draft lessons. They have not been reviewed by a teacher yet.
        </Text>
      </View>
      <Footer legend="OK: start   BACK: exit" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.paper},
  body: {
    flex: 1,
    paddingHorizontal: safe.horizontal,
    paddingVertical: safe.vertical,
    justifyContent: 'center',
  },
  hero: {fontSize: type.hero, fontWeight: '700', color: colors.green},
  tagline: {fontSize: type.title, color: colors.ink, marginBottom: 32},
  lead: {fontSize: type.body, color: colors.quiet, maxWidth: 1200, marginBottom: 56, lineHeight: 48},
  start: {alignSelf: 'flex-start', paddingHorizontal: 64, paddingVertical: 28},
  startText: {fontSize: type.choice, fontWeight: '700', color: colors.ink},
  draft: {fontSize: type.meta, color: colors.quiet, marginTop: 56},
});
