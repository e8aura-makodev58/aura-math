import {StyleSheet, Text, View} from 'react-native';
import {Focusable} from '../components/Focusable';
import {Footer} from '../components/Footer';
import type {TvTopicGroup} from '../engine/catalogue';
import {colors, safe, type} from '../theme';

export function LessonsScreen({group, focus}: {group: TvTopicGroup; focus: number}) {
  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>{group.topic.label}</Text>
        {group.lessons.map((entry, index) => (
          <Focusable key={entry.lesson.id} focused={index === focus} style={styles.row}>
            <Text style={styles.rowTitle}>{entry.lesson.title}</Text>
            <Text style={styles.rowMeta}>
              {entry.lesson.subtitle} · about {entry.lesson.minutes} min
            </Text>
          </Focusable>
        ))}
      </View>
      <Footer legend="Arrows: move   OK: start lesson   BACK: topics" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.paper},
  body: {flex: 1, paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical},
  title: {fontSize: type.title, fontWeight: '700', color: colors.green, marginBottom: 40},
  row: {paddingHorizontal: 40, paddingVertical: 24, marginBottom: 20},
  rowTitle: {fontSize: type.choice, fontWeight: '700', color: colors.ink},
  rowMeta: {fontSize: type.meta, color: colors.quiet, marginTop: 6},
});
