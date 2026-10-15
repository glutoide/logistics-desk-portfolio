// Independent demonstration model. All people, projects and prices are fictional.
export const STORE_KEY = 'logistics-desk-demo-v1';
export const STAGES = {
  new: { label: 'Ожидает назначения', next: null },
  assigned: { label: 'Подрядчик назначен', next: 'in_progress' },
  in_progress: { label: 'В работе', next: 'completed' },
  completed: { label: 'Завершён', next: null }
};

export const CONTRACTORS = [
  { id: 'a', name: 'ТехЛиния', city: 'Северный район', rating: 96, price: 18500, vehicles: [
    { id: 'a1', type: 'Каток', name: 'Каток № 14' }, { id: 'a2', type: 'Самосвал', name: 'Самосвал № 22' }] },
  { id: 'b', name: 'ГрунтПрофи', city: 'Центральный район', rating: 92, price: 16200, vehicles: [
    { id: 'b1', type: 'Экскаватор', name: 'Экскаватор № 07' }, { id: 'b2', type: 'Каток', name: 'Каток № 09' }] },
  { id: 'c', name: 'ДорТранс', city: 'Западный район', rating: 89, price: 14500, vehicles: [
    { id: 'c1', type: 'Самосвал', name: 'Самосвал № 35' }, { id: 'c2', type: 'Погрузчик', name: 'Погрузчик № 04' }] },
  { id: 'd', name: 'РегионМеханика', city: 'Восточный район', rating: 94, price: 17400, vehicles: [
    { id: 'd1', type: 'Экскаватор', name: 'Экскаватор № 16' }, { id: 'd2', type: 'Погрузчик', name: 'Погрузчик № 11' }] }
];
const pad = n => String(n).padStart(2, '0');
export function dayShift(days = 0, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-');
}
const initial = [
  ['LD-1042', 'Новый квартал', 'Уплотнение основания', 'Каток', 0, '09:00', 'high'],
  ['LD-1043', 'Транспортная развязка', 'Вывоз грунта', 'Самосвал', 0, '11:30', 'normal'],
  ['LD-1044', 'Парк набережной', 'Планировка траншеи', 'Экскаватор', 1, '08:00', 'normal'],
  ['LD-1045', 'Складской комплекс', 'Разгрузка материалов', 'Погрузчик', 1, '14:00', 'normal'],
  ['LD-1046', 'Дорога к микрорайону', 'Уплотнение щебня', 'Каток', 2, '10:00', 'high'],
  ['LD-1047', 'Новый квартал', 'Вывоз материалов', 'Самосвал', -1, '16:00', 'normal']
];
export function createDemo(now = new Date()) {
  return { version: 1, orders: initial.map(([id, project, task, equipment, offset, time, priority]) => ({
    id, project, task, equipment, date: dayShift(offset, now), time, priority, status: 'new',
    contractorId: null, vehicleId: null, actualCost: null, documents: [], history: [
      { at: new Date(now).toISOString(), text: 'Заявка создана' }
    ]
  })) };
}
export function readState(raw, now = new Date()) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.orders)) return createDemo(now);
    if (!parsed.orders.every(o => o && typeof o.id === 'string' && STAGES[o.status] && Array.isArray(o.history) && Array.isArray(o.documents))) return createDemo(now);
    return parsed;
  } catch { return createDemo(now); }
}
export function findOrder(state, id) {
  const order = state.orders.find(o => o.id === id);
  if (!order) throw new Error('Заявка не найдена');
  return order;
}
function record(order, text, now = new Date()) {
  order.history.unshift({ at: now.toISOString(), text });
}
function mutate(state, orderId, fn) {
  const next = structuredClone(state);
  fn(findOrder(next, orderId), next);
  return next;
}
function isBusy(state, order, vehicleId, date = order.date, time = order.time) {
  return state.orders.some(o => o.id !== order.id && o.vehicleId === vehicleId &&
    o.date === date && o.time === time && ['assigned', 'in_progress'].includes(o.status));
}
export function choices(state, orderId) {
  const order = findOrder(state, orderId);
  return CONTRACTORS.flatMap(c => c.vehicles
    .filter(v => v.type === order.equipment)
    .map(v => ({ contractor: c, vehicle: v, busy: isBusy(state, order, v.id) })))
    .sort((a, b) => Number(a.busy) - Number(b.busy) || b.contractor.rating - a.contractor.rating);
}
export function assign(state, orderId, contractorId, vehicleId, now = new Date()) {
  return mutate(state, orderId, (order, next) => {
    if (!['new', 'assigned'].includes(order.status)) throw new Error('Назначение на этом этапе закрыто');
    const candidate = choices(next, orderId).find(c => c.contractor.id === contractorId && c.vehicle.id === vehicleId);
    if (!candidate) throw new Error('Техника не подходит под заявку');
    if (candidate.busy) throw new Error('Техника уже занята в это время');
    order.contractorId = contractorId;
    order.vehicleId = vehicleId;
    order.status = 'assigned';
    record(order, 'Назначен подрядчик «' + candidate.contractor.name + '», ' + candidate.vehicle.name, now);
  });
}
export function schedule(state, orderId, date, time, now = new Date()) {
  return mutate(state, orderId, (order, next) => {
    if (order.status === 'completed') throw new Error('Завершённую заявку нельзя перенести');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
        Number.isNaN(new Date(date + 'T' + time + ':00').getTime())) throw new Error('Укажите корректные дату и время');
    if (order.vehicleId && isBusy(next, order, order.vehicleId, date, time)) throw new Error('Техника занята на новую дату и время');
    const previous = order.date + ' ' + order.time;
    order.date = date; order.time = time;
    record(order, 'Перенос: ' + previous + ' → ' + date + ' ' + time, now);
  });
}
export function advance(state, orderId, actualCost = null, now = new Date()) {
  return mutate(state, orderId, order => {
    const nextStatus = STAGES[order.status]?.next;
    if (!nextStatus) throw new Error('Невозможно изменить этап выполнения');
    if (nextStatus === 'completed') {
      const sum = Number(actualCost);
      if (!Number.isFinite(sum) || sum <= 0) throw new Error('Укажите фактическую стоимость больше нуля');
      order.actualCost = Math.round(sum);
    }
    order.status = nextStatus;
    record(order, nextStatus === 'in_progress' ? 'Работы начаты' : 'Работы завершены, факт: ' + order.actualCost + ' ₽', now);
  });
}
export function addDocument(state, orderId, name, now = new Date()) {
  return mutate(state, orderId, order => {
    const clean = String(name || '').trim().slice(0, 120);
    if (!clean) throw new Error('Введите название документа');
    order.documents.push({ id: 'doc-' + now.getTime(), name: clean, at: now.toISOString() });
    record(order, 'Зафиксирован документ: ' + clean, now);
  });
}
export function resetDemo(now = new Date()) { return createDemo(now); }
export function metrics(state) {
  const orders = state.orders;
  return {
    all: orders.length, new: orders.filter(o => o.status === 'new').length,
    active: orders.filter(o => ['assigned','in_progress'].includes(o.status)).length,
    done: orders.filter(o => o.status === 'completed').length,
    attention: orders.filter(o => o.priority === 'high' && o.status === 'new').length
  };
}
