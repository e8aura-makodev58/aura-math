import {StyleSheet, Text, View} from 'react-native';
import {Focusable} from '../components/Focusable';
import {Footer} from '../components/Footer';
import type {TvLessonEntry} from '../engine/catalogue';
import {TV_MAX_DIGITS} from '../engine/catalogue';
import type {DigitPicker} from '../engine/digits';
import type {TvState} from '../engine/tvState';
import {colors, safe, type} from '../theme';
import type {Choice, Step} from '../../../src/core/types';

export function QuestionScreen({entry, state}: {entry: TvLessonEntry; state: TvState}) {
  const session = state.session;
  if (!session) return null;
  const step = entry.lesson.steps[session.stepIndex];
  const solved = session.feedback?.outcome === 'correct';
  const total = entry.lesson.steps.length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.lessonTitle}>{entry.lesson.title}</Text>
        <Text style={styles.progress}>
          Question {session.stepIndex + 1} of {total}
        </Text>
      </View>

      <View style={styles.main}>
        <View style={styles.promptColumn}>
          <Text style={styles.story}>{entry.lesson.story}</Text>
          <Text style={styles.prompt}>{step.prompt}</Text>
        </View>
        <View style={styles.answerColumn}>
          {step.kind === 'number' ? (
            <DigitRow picker={state.picker} solved={solved} />
          ) : (
            (step.choices ?? []).map((choice, index) => (
              <ChoiceRow
                key={choice.id}
                choice={choice}
                focused={!solved && index === state.focus}
                tone={solved && index === state.focus ? 'correct' : 'neutral'}
              />
            ))
          )}
        </View>
      </View>

      <Feedback entry={entry} step={step} state={state} />

      <Footer legend={legendFor(step, solved)} />
    </View>
  );
}

function legendFor(step: Step, solved: boolean): string {
  if (solved) return 'OK: next question   BACK: leave lesson';
  if (step.kind === 'number') {
    return 'Up/Down: change digit   Left/Right: move   OK: answer   MENU: hint   BACK: leave lesson';
  }
  return 'Up/Down: choose   OK: answer   MENU: hint   BACK: leave lesson';
}

function ChoiceRow({choice, focused, tone}: {choice: Choice; focused: boolean; tone: 'neutral' | 'correct'}) {
  return (
    <Focusable focused={focused} tone={tone} style={styles.choice}>
      <Text style={styles.choiceText}>{choice.label}</Text>
    </Focusable>
  );
}

function DigitRow({picker, solved}: {picker: DigitPicker; solved: boolean}) {
  return (
    <View style={styles.digitRow}>
      {picker.digits.map((digit, index) => {
        const focused = !solved && index === picker.cursor;
        return (
          <Focusable key={index} focused={focused} style={styles.digitBox}>
            <Text style={styles.digitText}>{digit}</Text>
          </Focusable>
        );
      })}
      <Text style={styles.digitHint}>{TV_MAX_DIGITS} digits</Text>
    </View>
  );
}

function Feedback({entry, step, state}: {entry: TvLessonEntry; step: Step; state: TvState}) {
  const session = state.session;
  if (!session?.feedback) {
    return (
      <View style={styles.feedback}>
        <Text style={styles.feedbackText}>Choose an answer, then press OK.</Text>
      </View>
    );
  }
  const {feedback} = session;
  const correct = feedback.outcome === 'correct';
  const revealed = session.hintRung >= 4;
  const hint = session.hintRung > 0 && !correct ? step.hints[Math.min(session.hintRung, 4) - 1] : null;
  return (
    <View style={[styles.feedback, correct ? styles.feedbackCorrect : null]}>
      <Text style={[styles.feedbackText, correct ? styles.correctText : null]}>{feedback.feedback}</Text>
      {hint ? <Text style={styles.hintText}>Hint {session.hintRung} of 4: {hint}</Text> : null}
      {revealed && !correct ? (
        <Text style={styles.hintText}>Answer: {answerLabel(entry, step)}</Text>
      ) : null}
    </View>
  );
}

function answerLabel(entry: TvLessonEntry, step: Step): string {
  const value = entry.topic.answer(entry.lesson, step);
  if (step.kind === 'choice' || typeof value === 'string') {
    return step.choices?.find((choice) => choice.id === value)?.label ?? String(value);
  }
  return String(value);
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.paper},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: safe.horizontal,
    paddingTop: safe.vertical / 2,
    paddingBottom: 16,
  },
  lessonTitle: {fontSize: type.meta, fontWeight: '700', color: colors.green},
  progress: {fontSize: type.meta, color: colors.quiet},
  main: {flex: 1, flexDirection: 'row', paddingHorizontal: safe.horizontal, gap: 80, alignItems: 'center'},
  promptColumn: {flex: 1.2},
  story: {fontSize: type.body, color: colors.quiet, lineHeight: 46, marginBottom: 32},
  prompt: {fontSize: type.prompt, fontWeight: '700', color: colors.ink, lineHeight: 70},
  answerColumn: {flex: 1, gap: 20},
  choice: {paddingHorizontal: 40, paddingVertical: 24},
  choiceText: {fontSize: type.choice, fontWeight: '600', color: colors.ink},
  digitRow: {flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap'},
  digitBox: {width: 150, height: 190, alignItems: 'center', justifyContent: 'center'},
  digitText: {fontSize: 120, fontWeight: '700', color: colors.ink},
  digitHint: {fontSize: type.meta, color: colors.quiet, width: '100%', marginTop: 12},
  feedback: {
    paddingHorizontal: safe.horizontal,
    paddingVertical: 24,
    minHeight: 150,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  feedbackCorrect: {backgroundColor: colors.correctSurface},
  feedbackText: {fontSize: type.body, color: colors.ink},
  correctText: {color: colors.correct, fontWeight: '700'},
  hintText: {fontSize: type.body, color: colors.quiet, marginTop: 10},
});
