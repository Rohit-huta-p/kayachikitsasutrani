// src/app/shloka/[id]/hooks/playerReducer.test.ts
import { describe, it, expect } from 'vitest';
import {
  playerReducer,
  initialState,
  REPETITIONS,
  type PlayerState,
} from './playerReducer';

const CTX = { totalLines: 2 };

describe('playerReducer', () => {
  it('starts in IDLE', () => {
    expect(initialState).toEqual({ status: 'IDLE' });
  });

  it('PLAY from IDLE → PLAYING_LINE line 0 rep 1', () => {
    expect(playerReducer(initialState, { type: 'PLAY' }, CTX)).toEqual({
      status: 'PLAYING_LINE',
      line: 0,
      rep: 1,
    });
  });

  it('AUDIO_ENDED on rep < 3 in line mode → PAUSING_REP', () => {
    const s: PlayerState = { status: 'PLAYING_LINE', line: 0, rep: 1 };
    expect(playerReducer(s, { type: 'AUDIO_ENDED' }, CTX)).toEqual({
      status: 'PAUSING_REP',
      mode: 'LINE',
      line: 0,
      rep: 1,
    });
  });

  it('TIMER_DONE from PAUSING_REP line → next rep', () => {
    const s: PlayerState = { status: 'PAUSING_REP', mode: 'LINE', line: 0, rep: 1 };
    expect(playerReducer(s, { type: 'TIMER_DONE' }, CTX)).toEqual({
      status: 'PLAYING_LINE',
      line: 0,
      rep: 2,
    });
  });

  it('AUDIO_ENDED on last rep of line, more lines → PAUSING_LINE', () => {
    const s: PlayerState = { status: 'PLAYING_LINE', line: 0, rep: REPETITIONS };
    expect(playerReducer(s, { type: 'AUDIO_ENDED' }, CTX)).toEqual({
      status: 'PAUSING_LINE',
      nextLine: 1,
    });
  });

  it('AUDIO_ENDED on last rep of last line → PAUSING_FULL', () => {
    const s: PlayerState = { status: 'PLAYING_LINE', line: 1, rep: REPETITIONS };
    expect(playerReducer(s, { type: 'AUDIO_ENDED' }, CTX)).toEqual({
      status: 'PAUSING_FULL',
    });
  });

  it('TIMER_DONE from PAUSING_FULL → PLAYING_FULL rep 1', () => {
    const s: PlayerState = { status: 'PAUSING_FULL' };
    expect(playerReducer(s, { type: 'TIMER_DONE' }, CTX)).toEqual({
      status: 'PLAYING_FULL',
      rep: 1,
    });
  });

  it('AUDIO_ENDED on full last rep → DONE', () => {
    const s: PlayerState = { status: 'PLAYING_FULL', rep: REPETITIONS };
    expect(playerReducer(s, { type: 'AUDIO_ENDED' }, CTX)).toEqual({ status: 'DONE' });
  });

  it('full sequence: PLAY → all reps → DONE', () => {
    // 2 lines × 3 reps + full × 3 reps
    let s: PlayerState = initialState;
    s = playerReducer(s, { type: 'PLAY' }, CTX); // PLAYING_LINE 0 rep 1

    // Line 0: 3 reps
    for (let r = 1; r <= REPETITIONS; r++) {
      expect(s).toMatchObject({ status: 'PLAYING_LINE', line: 0, rep: r });
      s = playerReducer(s, { type: 'AUDIO_ENDED' }, CTX);
      if (r < REPETITIONS) {
        expect(s.status).toBe('PAUSING_REP');
        s = playerReducer(s, { type: 'TIMER_DONE' }, CTX);
      }
    }
    // After line 0 last rep, expect PAUSING_LINE → next line
    expect(s).toEqual({ status: 'PAUSING_LINE', nextLine: 1 });
    s = playerReducer(s, { type: 'TIMER_DONE' }, CTX);

    // Line 1: 3 reps
    for (let r = 1; r <= REPETITIONS; r++) {
      expect(s).toMatchObject({ status: 'PLAYING_LINE', line: 1, rep: r });
      s = playerReducer(s, { type: 'AUDIO_ENDED' }, CTX);
      if (r < REPETITIONS) {
        s = playerReducer(s, { type: 'TIMER_DONE' }, CTX);
      }
    }
    // After last line last rep, expect PAUSING_FULL
    expect(s).toEqual({ status: 'PAUSING_FULL' });
    s = playerReducer(s, { type: 'TIMER_DONE' }, CTX);

    // Full: 3 reps
    for (let r = 1; r <= REPETITIONS; r++) {
      expect(s).toMatchObject({ status: 'PLAYING_FULL', rep: r });
      s = playerReducer(s, { type: 'AUDIO_ENDED' }, CTX);
      if (r < REPETITIONS) {
        s = playerReducer(s, { type: 'TIMER_DONE' }, CTX);
      }
    }
    expect(s).toEqual({ status: 'DONE' });
  });

  it('PAUSE then RESUME restores previous state', () => {
    const s1: PlayerState = { status: 'PLAYING_LINE', line: 0, rep: 2 };
    const s2 = playerReducer(s1, { type: 'PAUSE' }, CTX);
    expect(s2).toEqual({ status: 'PAUSED', prev: s1 });
    const s3 = playerReducer(s2, { type: 'RESUME' }, CTX);
    expect(s3).toEqual(s1);
  });

  it('SKIP_NEXT in middle line → next line rep 1', () => {
    const s: PlayerState = { status: 'PLAYING_LINE', line: 0, rep: 2 };
    expect(playerReducer(s, { type: 'SKIP_NEXT' }, CTX)).toEqual({
      status: 'PLAYING_LINE',
      line: 1,
      rep: 1,
    });
  });

  it('SKIP_NEXT on last line → PLAYING_FULL rep 1', () => {
    const s: PlayerState = { status: 'PLAYING_LINE', line: 1, rep: 2 };
    expect(playerReducer(s, { type: 'SKIP_NEXT' }, CTX)).toEqual({
      status: 'PLAYING_FULL',
      rep: 1,
    });
  });

  it('SKIP_PREV in line 0 stays', () => {
    const s: PlayerState = { status: 'PLAYING_LINE', line: 0, rep: 2 };
    expect(playerReducer(s, { type: 'SKIP_PREV' }, CTX)).toEqual(s);
  });

  it('SKIP_PREV from PLAYING_FULL → last line rep 1', () => {
    const s: PlayerState = { status: 'PLAYING_FULL', rep: 2 };
    expect(playerReducer(s, { type: 'SKIP_PREV' }, CTX)).toEqual({
      status: 'PLAYING_LINE',
      line: 1,
      rep: 1,
    });
  });

  it('RESET from any state → IDLE', () => {
    const s: PlayerState = { status: 'PLAYING_FULL', rep: 2 };
    expect(playerReducer(s, { type: 'RESET' }, CTX)).toEqual({ status: 'IDLE' });
  });
});
