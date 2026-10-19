import {ENEMY_BEHAVIORS} from './enemy-behavior.js?v=637e9034956bdc32208d05c0403c280117b60bda';

// Presentation only: sample host-owned phases; never advance AI, damage or spells.
// The first half prepares; the second half releases and recovers exactly once.
export function enemyAttackFrame(type, intent, spell, frames) {
  if (!Number.isInteger(frames) || frames < 4 || frames > 16) return null;
  const split = Math.floor(frames / 2), tail = frames - split;
  const progress = (elapsed, duration) => Math.min(1, Math.max(0, elapsed / Math.max(.001, duration)));
  if (type === 'skeletal-mage' && spell) {
    if (spell.phase === 'windup') return Math.min(split - 1, Math.floor(progress(spell.elapsed, spell.duration) * split));
    if (spell.phase === 'flight') return split + Math.min(tail - 1, Math.floor(progress(spell.elapsed, 330) * tail));
    return null;
  }
  const profile = ENEMY_BEHAVIORS[type];
  if (!profile || !intent || !Number.isFinite(intent.remaining)) return null;
  if (intent.phase === 'windup') return Math.min(split - 1, Math.floor(progress(profile.windup - intent.remaining, profile.windup) * split));
  if (intent.phase === 'lunge') return Math.min(frames - 2, split + Math.floor(progress(profile.lunge - intent.remaining, profile.lunge) * Math.max(1, tail - 1)));
  if (intent.phase === 'recover') return split + Math.min(tail - 1, Math.floor(progress(profile.recovery - intent.remaining, .33) * tail));
  return null;
}
