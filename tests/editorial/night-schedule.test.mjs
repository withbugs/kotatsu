import test from 'node:test';
import assert from 'node:assert/strict';
import { NIGHT_SCHEDULE, nightClock, nextPublicationDate } from '../../scripts/editorial/night-schedule.mjs';
test('six roles retain every +12h daily slot', () => {
  assert.deepEqual(NIGHT_SCHEDULE, {'managing-editor':[21,0,4], 'editor-in-chief':[22], 'visual-editor':[22,6], 'copy-editor':[23,3], publisher:[1,5], 'writer-desk':[2]});
});
test('night recovery and worker stop have separate boundaries', () => {
  for (const [time, allowed] of [['20:59',false],['21:00',true],['00:00',true],['06:59',true],['07:00',false]]) {
    const clock=nightClock(new Date(`2026-10-03T${time}:00+09:00`));
    assert.equal(clock.recoveryAllowed,allowed,time); assert.equal(clock.workerAllowed,allowed,time);
  }
});
test('operational night retains the preceding date through 06:59 without changing the real date', () => {
  for (const [date,previous] of [['2026-10-05','2026-10-04'],['2026-11-01','2026-10-31'],['2027-01-01','2026-12-31']]) {
    const clock=nightClock(new Date(`${date}T00:00:00+09:00`));
    assert.equal(clock.date,date); assert.equal(clock.nightDate,previous);
  }
});
test('recovery publication crosses Sunday, month and year only at the real calendar boundary', () => {
  for (const [date,next] of [['2026-10-04','2026-10-05'],['2026-10-31','2026-11-01'],['2026-12-31','2027-01-01']]) {
    assert.equal(nextPublicationDate(new Date(`${date}T21:00:00+09:00`)),next);
    assert.equal(nextPublicationDate(new Date(`${date}T05:59:00+09:00`)),date);
    assert.equal(nextPublicationDate(new Date(`${date}T06:00:00+09:00`)),next);
  }
});
