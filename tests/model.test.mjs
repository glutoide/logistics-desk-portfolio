import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDemo, readState, choices, assign, schedule, advance, addDocument, metrics, dayShift
} from '../src/model.mjs';

const clock = new Date('2026-10-15T08:00:00');
const seed = () => createDemo(clock);

test('initial state uses generated demo projects and valid stages', () => {
  const state = seed();
  assert.equal(state.orders.length, 6);
  assert.equal(metrics(state).new, 6);
  assert.equal(readState(JSON.stringify(state)).orders.length, 6);
  assert.equal(readState('{invalid').orders.length, 6);
});

test('assignment accepts only matching contractor equipment', () => {
  const state = seed();
  assert.ok(choices(state, 'LD-1042').some(x => x.vehicle.id === 'a1'));
  assert.throws(() => assign(state, 'LD-1042', 'd', 'd1', clock), /не подходит/);
  const result = assign(state, 'LD-1042', 'a', 'a1', clock);
  assert.equal(result.orders[0].status, 'assigned');
  assert.equal(result.orders[0].vehicleId, 'a1');
  assert.equal(state.orders[0].status, 'new', 'immutable updates keep previous snapshot intact');
});

test('same vehicle cannot be double booked at identical time', () => {
  const original = seed();
  const first = assign(original, 'LD-1042', 'a', 'a1', clock);
  const second = schedule(first, 'LD-1046', first.orders[0].date, first.orders[0].time, clock);
  assert.throws(() => assign(second, 'LD-1046', 'a', 'a1', clock), /занята/);
  assert.ok(choices(second, 'LD-1046').find(c => c.vehicle.id === 'a1')?.busy);
});

test('rescheduling checks vehicle conflicts and writes event', () => {
  let state = seed();
  state = assign(state, 'LD-1042', 'a', 'a1', clock);
  state = assign(state, 'LD-1046', 'a', 'a1', clock);
  assert.throws(() => schedule(state,'LD-1046',state.orders[0].date,state.orders[0].time,clock), /занята/);
  const next = schedule(state,'LD-1046',dayShift(4,clock),'12:30',clock);
  assert.equal(next.orders.find(o=>o.id==='LD-1046').time,'12:30');
  assert.match(next.orders.find(o=>o.id==='LD-1046').history[0].text,/Перенос/);
});

test('order progress requires assignment then positive actual cost', () => {
  let state = seed();
  assert.throws(() => advance(state,'LD-1042',null,clock), /Невозможно/);
  state = assign(state,'LD-1042','a','a1',clock);
  state = advance(state,'LD-1042',null,clock);
  assert.equal(state.orders[0].status,'in_progress');
  assert.throws(() => advance(state,'LD-1042',0,clock), /больше нуля/);
  state = advance(state,'LD-1042',12500,clock);
  assert.equal(state.orders[0].status,'completed');
  assert.equal(state.orders[0].actualCost,12500);
  assert.equal(metrics(state).done,1);
  assert.throws(() => schedule(state,'LD-1042',dayShift(8,clock),'10:00',clock), /нельзя/);
});

test('document record persists in serializable state and history', () => {
  let state = addDocument(seed(),'LD-1042','Акт выполненных работ',clock);
  state = readState(JSON.stringify(state),clock);
  assert.equal(state.orders[0].documents[0].name,'Акт выполненных работ');
  assert.match(state.orders[0].history[0].text,/Акт выполненных работ/);
});

test('bad or incompatible stored data triggers safe demo reset', () => {
  assert.equal(readState(JSON.stringify({version:2,orders:[]}),clock).orders.length,6);
  assert.equal(readState(JSON.stringify({version:1,orders:[{id:'x'}]}),clock).orders.length,6);
});
