import {TV_MAX_DIGITS} from './catalogue';

/** Digit picker for number steps: up/down change the digit, left/right move the cursor. */
export interface DigitPicker {
  digits: number[];
  cursor: number;
}

export function emptyDigits(): DigitPicker {
  return {digits: Array.from({length: TV_MAX_DIGITS}, () => 0), cursor: TV_MAX_DIGITS - 1};
}

export function changeDigit(picker: DigitPicker, delta: 1 | -1): DigitPicker {
  const digits = picker.digits.slice();
  digits[picker.cursor] = (digits[picker.cursor] + delta + 10) % 10;
  return {...picker, digits};
}

export function moveCursor(picker: DigitPicker, delta: 1 | -1): DigitPicker {
  const cursor = Math.min(TV_MAX_DIGITS - 1, Math.max(0, picker.cursor + delta));
  return {...picker, cursor};
}

/** Leading zeros are ignored, so 007 is 7. */
export function digitsToNumber(picker: DigitPicker): number {
  return picker.digits.reduce((total, digit) => total * 10 + digit, 0);
}
