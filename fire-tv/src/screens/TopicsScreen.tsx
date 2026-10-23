import {StyleSheet, Text, View} from 'react-native';
import {Focusable} from '../components/Focusable';
import {Footer} from '../components/Footer';
import type {TvTopicGroup} from '../engine/catalogue';
import {colors, safe, type} from '../theme';

export function TopicsScreen({groups, focus}: {groups: readonly TvTopicGroup[]; focus: number}) {
  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>Choose a topic</Text>
        <View style={styles.grid}>
          {groups.map((group, index) => (
            <Focusable key={group.topic.id} focused={index === focus} style={styles.card}>
              <Text style={styles.cardTitle}>{group.topic.label}</Text>
              <Text style={styles.cardMeta}>
                {group.lessons.length} {group.lessons.length === 1 ? 'lesson' : 'lessons'}
              </Text>
            </Focusable>
          ))}
        </View>
      </View>
      <Footer legend="Arrows: move   OK: open topic   BACK: home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.paper},
  body: {flex: 1, paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical},
  title: {fontSize: type.title, fontWeight: '700', color: colors.green, marginBottom: 40},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 28},
  card: {width: 760, paddingHorizontal: 40, paddingVertical: 28},
  cardTitle: {fontSize: type.choice, fontWeight: '700', color: colors.ink},
  cardMeta: {fontSize: type.meta, color: colors.quiet, marginTop: 8},
});
