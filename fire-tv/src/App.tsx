import {useCallback, useEffect, useReducer} from 'react';
import {BackHandler, StyleSheet, View} from 'react-native';
// Vega's remote input hook is exported by the Kepler fork, not by stock react-native.
import {useTVEventHandler} from '@amazon-devices/react-native-kepler';
import {HomeScreen} from './screens/HomeScreen';
import {TopicsScreen} from './screens/TopicsScreen';
import {LessonsScreen} from './screens/LessonsScreen';
import {QuestionScreen} from './screens/QuestionScreen';
import {SummaryScreen} from './screens/SummaryScreen';
import {buildTvCatalogue} from './engine/catalogue';
import {remoteKeyFor, type RemoteKey} from './engine/remote';
import {currentEntry, initialTvState, navigate, summarise, type TvState} from './engine/tvState';
import {colors} from './theme';

/** Built once from the shared lesson snapshot; the TV only shows lessons it can run. */
const GROUPS = buildTvCatalogue();

function reduce(state: TvState, key: RemoteKey): TvState {
  return navigate(state, key, GROUPS);
}

export default function App() {
  const [state, dispatch] = useReducer(reduce, undefined, initialTvState);

  useTVEventHandler(
    useCallback(
      (event) => {
        const key = remoteKeyFor(event);
        if (key) dispatch(key);
      },
      [],
    ),
  );

  useEffect(() => {
    if (state.exitRequested) BackHandler.exitApp();
  }, [state.exitRequested]);

  return <View style={styles.root}>{renderScreen(state)}</View>;
}

function renderScreen(state: TvState) {
  const entry = currentEntry(state, GROUPS);
  switch (state.screen) {
    case 'home':
      return <HomeScreen />;
    case 'topics':
      return <TopicsScreen groups={GROUPS} focus={state.focus} />;
    case 'lessons':
      return <LessonsScreen group={GROUPS[state.topicIndex]} focus={state.focus} />;
    case 'question':
      return entry && state.session ? <QuestionScreen entry={entry} state={state} /> : <HomeScreen />;
    case 'summary':
      return entry && state.session ? (
        <SummaryScreen summary={summarise(state.session, entry)} focus={state.focus} />
      ) : (
        <HomeScreen />
      );
  }
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.paper},
});
