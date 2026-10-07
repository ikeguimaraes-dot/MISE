import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedDays} from '../src/lib/operational-calendar.ts';
test('calendar includes days never opened and excludes closed weekdays',()=>assert.deepEqual(expectedDays('2026-09-28','2026-10-05',[{dia_semana:1,periodo:'almoco'},{dia_semana:1,periodo:'jantar'},{dia_semana:5,periodo:'jantar'}]),['2026-09-28','2026-10-02','2026-10-05']));
test('no schedule does not fabricate missed operations',()=>assert.deepEqual(expectedDays('2026-09-28','2026-10-05',[]),[]));

import {operationalDay} from '../src/lib/operational-calendar.ts';
import {weekDays} from '../src/lib/extras/alcada.ts';
test('Extras follows Sao Paulo operational date through Sunday/Monday rollover',()=>{
 assert.equal(operationalDay(new Date('2026-10-12T02:59:59Z')),'2026-10-11');
 assert.equal(weekDays(operationalDay(new Date('2026-10-12T02:59:59Z')))[0],'2026-10-05');
 assert.equal(operationalDay(new Date('2026-10-12T03:00:00Z')),'2026-10-12');
 assert.equal(weekDays(operationalDay(new Date('2026-10-12T03:00:00Z')))[0],'2026-10-12');
});
