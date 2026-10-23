import {StyleSheet, Text, View} from 'react-native';
import {Focusable} from '../components/Focusable';
import {Footer} from '../components/Footer';
import type {SessionSummary} from '../engine/tvState';
import {SUMMARY_ACTIONS} from '../engine/tvState';
import {colors, safe, type} from '../theme';

const ACTION_LABELS: Record<(typeof SUMMARY_ACTIONS)[number], string> = {
  again: 'Try this lesson again',
  lessons: 'Choose another lesson',
  home: 'Home',
};

export function SummaryScreen({summary, focus}: {summary: SessionSummary; focus: number}) {
  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>Lesson complete</Text>
        <Text style={styles.lesson}>{summary.lessonTitle}</Text>
        <View style={styles.stats}>
          <Stat label="Questions completed" value={`${summary.stepsCompleted} of ${summary.stepsTotal}`} />
          <Stat label="Right first time" value={String(summary.firstTryCorrect)} />
          <Stat label="Hints used" value={String(summary.hintsUsed)} />
          <Stat label="Topic" value={summary.topicLabel} />
        </View>
        <Text style={styles.completion}>{summary.completion}</Text>
        <View style={styles.actions}>
          {SUMMARY_ACTIONS.map((action, index) => (
            <Focusable key={action} focused={index === focus} style={styles.action}>
              <Text style={styles.actionText}>{ACTION_LABELS[action]}</Text>
            </Focusable>
          ))}
        </View>
      </View>
      <Footer legend="Arrows: move   OK: choose   BACK: lessons" />
    </View>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.paper},
  body: {flex: 1, paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical},
  title: {fontSize: type.title, fontWeight: '700', color: colors.green},
  lesson: {fontSize: type.body, color: colors.ink, marginTop: 8, marginBottom: 40},
  stats: {flexDirection: 'row', flexWrap: 'wrap', gap: 32, marginBottom: 24},
  stat: {width: 380, paddingVertical: 20},
  statValue: {fontSize: type.prompt, fontWeight: '700', color: colors.ink},
  statLabel: {fontSize: type.meta, color: colors.quiet, marginTop: 6},
  completion: {fontSize: type.body, color: colors.quiet, marginBottom: 40},
  actions: {gap: 16},
  action: {width: 900, paddingHorizontal: 40, paddingVertical: 22},
  actionText: {fontSize: type.body, fontWeight: '700', color: colors.ink},
});
