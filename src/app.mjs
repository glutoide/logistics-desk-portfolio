import {
  STORE_KEY, STAGES, CONTRACTORS, readState, createDemo, findOrder, choices,
  assign, schedule, advance, addDocument, metrics, dayShift
} from './model.mjs';

const root = document.getElementById('app');
let state = readState(localStorage.getItem(STORE_KEY));
let page = 'dashboard', stageFilter = 'all', search = '', selected = state.orders[0]?.id || null;
const statusClass = s => 'badge badge--' + s;
const formatDay = value => {
  const d = new Date(value + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(d);
};
const formatDateTime = value => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }).format(d);
};
const money = number => new Intl.NumberFormat('ru-RU').format(number) + ' ₽';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, v =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[v]));
const icon = name => ({ dashboard:'▦', orders:'≡', partners:'◈' }[name]);
const today = dayShift();
function persist(next) { state = next; localStorage.setItem(STORE_KEY, JSON.stringify(state)); render(); }
function selectedOrder() { try { return findOrder(state, selected); } catch { return state.orders[0]; } }
function notification(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show' + (isError ? ' toast--error' : '');
  clearTimeout(notification.timer);
  notification.timer = setTimeout(() => toast.classList.remove('show'), 3300);
}
function doAction(fn, success) {
  try { persist(fn()); notification(success); }
  catch (error) { notification(error?.message || 'Не удалось выполнить действие', true); }
}
function header() {
  return `<header class="header">
    <a class="brand" href="#" data-page="dashboard"><span class="brand__logo">LD</span><span>Logistics <b>Desk</b><small>DEMO WORKSPACE</small></span></a>
    <div class="header__right"><span class="online"><span class="online__dot"></span> Автономная демонстрация</span>
    <span class="avatar" aria-label="Демо-диспетчер">Д</span></div>
  </header>`;
}
function navigation() {
  const links = [['dashboard', 'Обзор'], ['orders', 'Все заявки'], ['partners', 'Подрядчики']];
  return `<aside class="navigation">
  <div class="nav__caption">РАБОЧЕЕ МЕСТО</div>
  <nav aria-label="Главная навигация">${links.map(([key,label]) => `<button class="navitem ${page === key ? 'navitem--active' : ''}" type="button" data-page="${key}"><span class="navitem__icon">${icon(key)}</span>${label}</button>`).join('')}</nav>
  <div class="nav__bottom"><span class="eyebrow">ПОРТФОЛИО</span><b>Только демонстрационные данные</b><p>Без сервера, API, доступа к чужим проектам и реальных документов.</p></div>
  </aside>`;
}
function stats() {
  const s = metrics(state);
  return `<section class="stats" aria-label="Статистика заявок">
  ${[
    ['Всего заявок',s.all,'all'], ['Ждут назначения',s.new,'waiting'],
    ['В работе',s.active,'active'], ['Завершено',s.done,'done']
  ].map(([label,value,kind]) => `<article class="stat stat--${kind}"><span>${label}</span><strong>${value}</strong></article>`).join('')}
  </section>`;
}
function filteredOrders() {
  let list = [...state.orders];
  if (stageFilter !== 'all') list = list.filter(o => o.status === stageFilter);
  if (search) {
    const term = search.toLocaleLowerCase('ru');
    list = list.filter(o => [o.id, o.project, o.task, o.equipment].some(v => String(v).toLocaleLowerCase('ru').includes(term)));
  }
  return list.sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}
function orderCard(o) {
  const contractor = CONTRACTORS.find(c => c.id === o.contractorId);
  return `<button type="button" class="order-row ${selected === o.id ? 'order-row--selected' : ''}" data-order="${escapeHtml(o.id)}">
    <span class="order-row__date"><b>${formatDay(o.date)}</b><small>${escapeHtml(o.time)}</small></span>
    <span class="order-row__main"><span class="order-row__title">${escapeHtml(o.project)}</span><small>${escapeHtml(o.id)} · ${escapeHtml(o.task)}</small>
    <span class="order-row__tags"><span class="equip-tag">${escapeHtml(o.equipment)}</span>${o.priority==='high' ? '<span class="hot-tag">Приоритет</span>' : ''}</span></span>
    <span class="order-row__end"><span class="${statusClass(o.status)}">${STAGES[o.status].label}</span>
    <small>${escapeHtml(contractor?.name || 'Не назначен')}</small></span>
    <span class="chevron">›</span>
  </button>`;
}
function ordersScreen() {
  const list = filteredOrders();
  return `<section class="panel orders-panel">
    <div class="panel__top"><div><h2>Заявки</h2><p>${list.length} из ${state.orders.length} · выберите заявку для работы</p></div>
    <span class="panel__meta">Обновляется локально</span></div>
    <div class="toolbar"><label class="search">⌕ <input id="search" type="search" placeholder="Проект, номер, техника…" value="${escapeHtml(search)}" aria-label="Поиск заявок"></label>
      <select id="status-filter" aria-label="Фильтр по статусу">
      ${[['all','Все статусы'],...Object.entries(STAGES).map(([key,v]) => [key,v.label])].map(([key,label])=>`<option value="${key}" ${stageFilter===key?'selected':''}>${label}</option>`).join('')}
      </select></div>
    <div class="order-list">${list.length ? list.map(orderCard).join('') : '<p class="empty">По вашему запросу ничего не найдено.</p>'}</div>
  </section>`;
}
function partnersScreen() {
  return `<section class="panel"><div class="panel__top"><div><h2>Подрядчики и техника</h2><p>Пример каталога с синтетическими данными</p></div></div>
  <div class="partners-grid">${CONTRACTORS.map(c => `<article class="partner"><div class="partner__top"><span class="partner__mark">${escapeHtml(c.name.slice(0,1))}</span><span class="score">${c.rating}% условный рейтинг</span></div>
    <h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.city)} · от ${money(c.price)} / смена</p>
    <div class="partner__vehicles">${c.vehicles.map(v=>`<span class="equip-tag">${escapeHtml(v.name)}</span>`).join('')}</div></article>`).join('')}</div>
    <div class="hint"><b>Важно:</b> рейтинг и цены вымышлены и не являются реальной оценкой компаний.</div>
  </section>`;
}
function activity() {
  const events = state.orders.flatMap(o => o.history.slice(0,3).map(e => ({...e, id:o.id})))
    .sort((a,b) => b.at.localeCompare(a.at)).slice(0,6);
  return `<section class="panel activity"><div class="panel__top"><div><h2>Последние события</h2><p>История изменений демонстрационных заявок</p></div></div>
  <div class="events">${events.map(e => `<div class="event"><span class="event__dot"></span><div><b>${escapeHtml(e.text)}</b><small>${escapeHtml(e.id)} · ${formatDateTime(e.at)}</small></div></div>`).join('')}</div></section>`;
}
function main() {
  const isHome = page === 'dashboard';
  return `<main class="main"><div class="page-head"><div><span class="eyebrow">ЛОГИСТИКА / РАБОЧИЙ ДЕНЬ</span><h1>${isHome ? 'Панель диспетчера' : page === 'orders' ? 'Управление заявками' : 'База подрядчиков'}</h1>
    <p>${isHome ? 'От потребности до подтверждённого выполнения.' : page === 'orders' ? 'Планирование, назначения и история в одном месте.' : 'Доступные ресурсы для планирования выездов.'}</p></div>
    <button class="reset" type="button" data-action="reset">↻ Сбросить демо</button></div>
    ${isHome ? `${stats()}${metrics(state).attention? `<div class="attention"><span>!</span> <b>${metrics(state).attention} приоритетные заявки</b> ожидают назначения подрядчика.</div>` : ''}
        ${ordersScreen()}${activity()}` : page === 'orders' ? ordersScreen() : partnersScreen()}
    <footer>Независимый демонстрационный проект · Данные хранятся только в браузере · <span>Без реального сервера и интеграций</span></footer>
  </main>`;
}
function detail() {
  const o = selectedOrder();
  if (!o) return '<aside class="detail"></aside>';
  const contractor = CONTRACTORS.find(c=>c.id===o.contractorId);
  const vehicle = contractor?.vehicles.find(v=>v.id===o.vehicleId);
  const available = choices(state,o.id);
  return `<aside class="detail" aria-label="Детали заявки">
    <div class="detail__head"><span class="eyebrow">КАРТОЧКА ЗАЯВКИ</span><h2>${escapeHtml(o.id)}</h2><span class="${statusClass(o.status)}">${STAGES[o.status].label}</span></div>
    <div class="detail__body">
    <h3>${escapeHtml(o.project)}</h3><p class="detail__task">${escapeHtml(o.task)}</p>
    <div class="facts"><div><span>Техника</span><b>${escapeHtml(o.equipment)}</b></div><div><span>Дата и время</span><b>${formatDay(o.date)} · ${escapeHtml(o.time)}</b></div>
    <div><span>Подрядчик</span><b>${escapeHtml(contractor?.name || 'Не назначен')}</b></div><div><span>Единица техники</span><b>${escapeHtml(vehicle?.name || '—')}</b></div></div>
    ${o.status !== 'completed' ? `<form class="card-form" id="schedule-form">
      <h4>Планирование</h4><div class="two-cols"><label>Дата<input type="date" name="date" value="${escapeHtml(o.date)}" required></label>
      <label>Время<input type="time" name="time" value="${escapeHtml(o.time)}" required></label></div>
      <button class="btn btn--outline" type="submit">Сохранить дату и время</button></form>` : `<div class="done-cost">Фактическая стоимость <strong>${money(o.actualCost)}</strong></div>`}
    ${['new','assigned'].includes(o.status) ? `<div class="assignment"><h4>Выбор техники</h4><p>Подходящие варианты · учитывается занятость на дату и время</p>
    ${available.map(c=>`<div class="choice"><div><b>${escapeHtml(c.contractor.name)}</b><small>${escapeHtml(c.vehicle.name)} · рейтинг ${c.contractor.rating}%</small></div>
    <button type="button" class="mini-btn" data-action="assign" data-contractor="${c.contractor.id}" data-vehicle="${c.vehicle.id}" ${c.busy?'disabled':''}>${c.busy?'Занят':o.vehicleId===c.vehicle.id?'Выбран':'Назначить'}</button></div>`).join('')}
    </div>` : ''}
    ${o.status === 'assigned' ? '<button type="button" class="btn btn--primary" data-action="advance">Начать выполнение →</button>' : ''}
    ${o.status === 'in_progress' ? `<form class="card-form" id="complete-form"><h4>Завершение работ</h4>
      <label>Фактическая стоимость, ₽<input name="cost" type="number" min="1" step="1" placeholder="Например, 18000" required></label>
      <button class="btn btn--primary" type="submit">Зафиксировать выполнение →</button></form>` : ''}
    <form id="document-form" class="card-form"><h4>Документы</h4><p class="fineprint">Демо: сохраняется только название документа, сам файл не загружается.</p>
      <label>Название документа<input name="name" placeholder="Например, акт выполненных работ" maxlength="120" required></label>
      <button type="submit" class="btn btn--outline">Добавить запись</button></form>
    <div class="doc-list">${o.documents.map(d=>`<div class="doc">▤ <span>${escapeHtml(d.name)}</span><small>${formatDateTime(d.at)}</small></div>`).join('')}</div>
    <h4 class="history-title">История</h4><div class="history">${o.history.slice(0,10).map(h=>`<div><span>${escapeHtml(h.text)}</span><small>${formatDateTime(h.at)}</small></div>`).join('')}</div>
    </div>
  </aside>`;
}
function render() { root.innerHTML = header() + `<div class="layout">${navigation()}${main()}${detail()}</div><div class="toast" id="toast" role="status" aria-live="polite"></div>`; }
root.addEventListener('click', e => {
  const pageButton = e.target.closest('[data-page]');
  if (pageButton) { e.preventDefault(); page = pageButton.dataset.page; render(); return; }
  const orderButton = e.target.closest('[data-order]');
  if (orderButton) { selected = orderButton.dataset.order; render(); return; }
  const action = e.target.closest('[data-action]');
  if (!action) return;
  const type = action.dataset.action;
  if (type === 'reset') {
    if (confirm('Сбросить все локальные изменения и вернуть исходные демонстрационные заявки?')) {
      selected = 'LD-1042'; stageFilter = 'all'; search = ''; persist(createDemo()); notification('Демонстрационные данные восстановлены');
    }
  } else if (type === 'assign') doAction(() => assign(state, selected, action.dataset.contractor, action.dataset.vehicle), 'Назначение сохранено');
  else if (type === 'advance') doAction(() => advance(state, selected), 'Статус заявки обновлён');
});
root.addEventListener('submit', e => {
  const id = e.target.id;
  if (!['schedule-form','complete-form','document-form'].includes(id)) return;
  e.preventDefault();
  const f = new FormData(e.target);
  if (id === 'schedule-form') doAction(() => schedule(state, selected, String(f.get('date')), String(f.get('time'))), 'План изменён; запись добавлена в историю');
  else if (id === 'complete-form') doAction(() => advance(state, selected, f.get('cost')), 'Выполнение зафиксировано');
  else doAction(() => addDocument(state, selected, f.get('name')), 'Название документа сохранено локально');
});
root.addEventListener('change', e => {
  if (e.target.id === 'status-filter') { stageFilter = e.target.value; render(); }
  if (e.target.id === 'search') { search = e.target.value.trim(); render(); }
});
root.addEventListener('keydown', e => {
  if (e.target.id === 'search' && e.key === 'Enter') { e.preventDefault(); search = e.target.value.trim(); render(); }
});
render();
