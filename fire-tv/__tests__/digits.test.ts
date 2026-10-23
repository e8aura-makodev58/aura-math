import {changeDigit, digitsToNumber, emptyDigits, moveCursor} from '../src/engine/digits';

describe('digit picker', () => {
  it('starts at zero with the cursor on the ones place', () => {
    expect(emptyDigits()).toEqual({digits: [0, 0, 0], cursor: 2});
  });

  it('wraps a digit from 9 to 0 and from 0 to 9', () => {
    const up = changeDigit({digits: [0, 0, 9], cursor: 2}, 1);
    expect(up.digits[2]).toBe(0);
    const down = changeDigit({digits: [0, 0, 0], cursor: 2}, -1);
    expect(down.digits[2]).toBe(9);
  });

  it('clamps the cursor at both ends', () => {
    expect(moveCursor({digits: [0, 0, 0], cursor: 0}, -1).cursor).toBe(0);
    expect(moveCursor({digits: [0, 0, 0], cursor: 2}, 1).cursor).toBe(2);
  });

  it('reads the digits as a number and ignores leading zeros', () => {
    expect(digitsToNumber({digits: [0, 0, 7], cursor: 2})).toBe(7);
    expect(digitsToNumber({digits: [1, 2, 0], cursor: 0})).toBe(120);
  });
});
