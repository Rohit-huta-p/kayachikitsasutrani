// src/app/shloka/[id]/hooks/playerReducer.ts

export const REPETITIONS = 3;

export type PlayerState =
  | { status: 'IDLE' }
  | { status: 'PLAYING_LINE'; line: number; rep: number }
  | { status: 'PLAYING_FULL'; rep: number }
  | { status: 'PAUSING_REP'; mode: 'LINE' | 'FULL'; line: number; rep: number }
  | { status: 'PAUSING_LINE'; nextLine: number }
  | { status: 'PAUSING_FULL' }
  | { status: 'PAUSED'; prev: PlayerState }
  | { status: 'DONE' };

export type PlayerEvent =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'AUDIO_ENDED' }
  | { type: 'TIMER_DONE' }
  | { type: 'SKIP_NEXT' }
  | { type: 'SKIP_PREV' };

export interface ReducerCtx {
  totalLines: number;
}

export function playerReducer(
  state: PlayerState,
  event: PlayerEvent,
  ctx: ReducerCtx,
): PlayerState {
  switch (event.type) {
    case 'PLAY':
      if (state.status === 'IDLE' || state.status === 'DONE') {
        return { status: 'PLAYING_LINE', line: 0, rep: 1 };
      }
      return state;

    case 'PAUSE':
      if (
        state.status === 'PLAYING_LINE' ||
        state.status === 'PLAYING_FULL' ||
        state.status === 'PAUSING_REP' ||
        state.status === 'PAUSING_LINE' ||
        state.status === 'PAUSING_FULL'
      ) {
        return { status: 'PAUSED', prev: state };
      }
      return state;

    case 'RESUME':
      if (state.status === 'PAUSED') return state.prev;
      return state;

    case 'RESET':
      return { status: 'IDLE' };

    case 'AUDIO_ENDED':
      if (state.status === 'PLAYING_LINE') {
        if (state.rep < REPETITIONS) {
          return { status: 'PAUSING_REP', mode: 'LINE', line: state.line, rep: state.rep };
        }
        if (state.line < ctx.totalLines - 1) {
          return { status: 'PAUSING_LINE', nextLine: state.line + 1 };
        }
        return { status: 'PAUSING_FULL' };
      }
      if (state.status === 'PLAYING_FULL') {
        if (state.rep < REPETITIONS) {
          return { status: 'PAUSING_REP', mode: 'FULL', line: 0, rep: state.rep };
        }
        return { status: 'DONE' };
      }
      return state;

    case 'TIMER_DONE':
      if (state.status === 'PAUSING_REP') {
        return state.mode === 'LINE'
          ? { status: 'PLAYING_LINE', line: state.line, rep: state.rep + 1 }
          : { status: 'PLAYING_FULL', rep: state.rep + 1 };
      }
      if (state.status === 'PAUSING_LINE') {
        return { status: 'PLAYING_LINE', line: state.nextLine, rep: 1 };
      }
      if (state.status === 'PAUSING_FULL') {
        return { status: 'PLAYING_FULL', rep: 1 };
      }
      return state;

    case 'SKIP_NEXT':
      if (state.status === 'PLAYING_LINE' && state.line < ctx.totalLines - 1) {
        return { status: 'PLAYING_LINE', line: state.line + 1, rep: 1 };
      }
      if (state.status === 'PLAYING_LINE' && state.line === ctx.totalLines - 1) {
        return { status: 'PLAYING_FULL', rep: 1 };
      }
      return state;

    case 'SKIP_PREV':
      if (state.status === 'PLAYING_LINE' && state.line > 0) {
        return { status: 'PLAYING_LINE', line: state.line - 1, rep: 1 };
      }
      if (state.status === 'PLAYING_FULL') {
        return { status: 'PLAYING_LINE', line: ctx.totalLines - 1, rep: 1 };
      }
      return state;

    default:
      return state;
  }
}

export const initialState: PlayerState = { status: 'IDLE' };
