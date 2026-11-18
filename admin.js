"use strict";
// @ts-nocheck
const db = window.supabase.createClient('https://gqtqpjqnraozoumohzpk.supabase.co', 'sb_publishable_ReWzF60tqezy7KnsdPdQmA_6HK0gW2I');
let currentMode = 'single';
let mainAction = 'block';
let displayedYear = new Date().getFullYear();
let displayedMonth = new Date().getMonth();
async function checkUserSession() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        document.getElementById('login-screen')?.style.setProperty('display', 'none');
        document.getElementById('admin-dashboard')?.style.setProperty('display', 'block');
        loadAdminData();
        renderDynamicCalendar();
    }
}
checkUserSession();
document.getElementById('login-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-pass').value;
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
        alert('Ошибка входа: ' + error.message);
    }
    else {
        document.getElementById('login-screen')?.style.setProperty('display', 'none');
        document.getElementById('admin-dashboard')?.style.setProperty('display', 'block');
        loadAdminData();
        renderDynamicCalendar();
    }
});
// Переключение вкладок действий (Блокировка дней / Открыть)
document.querySelectorAll('.action-tab-btn').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.action-tab-btn').forEach(t => {
            t.style.background = '#f1f5f9';
            t.style.color = '#64748b';
        });
        const target = e.currentTarget;
        mainAction = target.dataset.action || 'block';
        const submitBtn = document.getElementById('add-block-btn');
        const openPanel = document.getElementById('open-time-panel');
        if (mainAction === 'block') {
            target.style.background = '#fee2e2';
            target.style.color = '#991b1b';
            if (submitBtn) {
                submitBtn.style.display = 'block';
                submitBtn.textContent = '🔒 Заблокировать день полностью';
            }
            if (openPanel)
                openPanel.style.display = 'none';
        }
        else {
            target.style.background = '#d1fae5';
            target.style.color = '#065f46';
            if (submitBtn) {
                submitBtn.style.display = 'block';
                submitBtn.textContent = '✅ Снять блокировку / Открыть день';
            }
            if (openPanel)
                openPanel.style.display = 'block';
        }
    });
});
const startInput = document.getElementById('block-date-start');
// Кнопка сохранения полной блокировки или снятия блокировки
document.getElementById('add-block-btn')?.addEventListener('click', async () => {
    if (!startInput?.value) {
        alert('Сначала выберите дату в календаре!');
        return;
    }
    if (mainAction === 'block') {
        // Удаляем старые записи для этой даты и сохраняем полную блокировку (start_time = null)
        await db.from('blocked_dates').delete().eq('block_date', startInput.value);
        const { error } = await db.from('blocked_dates').insert([
            { block_date: startInput.value, room: 'beauty', start_time: null, end_time: null, reason: 'Заблокировано полностью' },
            { block_date: startInput.value, room: 'speech', start_time: null, end_time: null, reason: 'Заблокировано полностью' }
        ]);
        if (error) {
            alert('Ошибка блокировки дня: ' + error.message);
        }
        else {
            alert('День успешно заблокирован и сохранен!');
            await loadAdminData();
            await renderDynamicCalendar();
        }
    }
    else {
        // В режиме открытия — полностью удаляем все блокировки на выбранный день
        const { error } = await db.from('blocked_dates').delete().eq('block_date', startInput.value);
        if (error) {
            alert('Ошибка снятия блокировки: ' + error.message);
        }
        else {
            alert('Блокировка снята, день открыт!');
            await loadAdminData();
            await renderDynamicCalendar();
        }
    }
});
// Кнопка добавления точечного слота
document.getElementById('add-slot-btn')?.addEventListener('click', async () => {
    const timeInput = document.getElementById('single-slot-input');
    const roomSelect = document.querySelector('.admin-dashboard select, select#block-room, select');
    if (!startInput?.value) {
        alert('Сначала выберите дату в календаре!');
        return;
    }
    if (!timeInput?.value) {
        alert('Введите время слота!');
        return;
    }
    const roomChoice = roomSelect ? roomSelect.value : 'combo';
    let rooms = [];
    let reasonText = 'Открыто администратором';
    if (roomChoice === 'combo' || roomChoice === 'all' || roomChoice.includes('Комбо')) {
        rooms = ['speech', 'beauty'];
        reasonText = 'Комбо слот';
    }
    else if (roomChoice === 'speech' || roomChoice.includes('Специалист по развитию речи и дефектолог')) {
        rooms = ['speech'];
        reasonText = 'Коррекция речи';
    }
    else if (roomChoice === 'massage' || roomChoice.includes('Массаж')) {
        rooms = ['massage'];
        reasonText = 'Массаж';
    }
    else if (roomChoice === 'cosmetology' || roomChoice.includes('Косметология')) {
        rooms = ['cosmetology'];
        reasonText = 'Косметология';
    }
    else if (roomChoice === 'psychology' || roomChoice.includes('Психология')) {
        rooms = ['psychology'];
        reasonText = 'Психология';
    }
    else {
        rooms = ['beauty'];
        reasonText = 'Услуга';
    }
    // Удаляем старые пустые заглушки (NULL) перед добавлением слота
    for (const r of rooms) {
        await db.from('blocked_dates')
            .delete()
            .eq('block_date', startInput.value)
            .eq('room', r)
            .is('start_time', null);
    }
    const rows = rooms.map(r => ({
        block_date: startInput.value,
        room: r,
        start_time: `${timeInput.value}:00`,
        end_time: `${timeInput.value}:00`,
        reason: reasonText
    }));
    const { error } = await db.from('blocked_dates').insert(rows);
    if (error) {
        alert('Ошибка добавления слота: ' + error.message);
    }
    else {
        timeInput.value = '';
        await loadAdminData();
        await renderDynamicCalendar();
    }
});
// Генератор календаря
async function renderDynamicCalendar() {
    const gridContainer = document.getElementById('dynamic-cal-grid');
    const titleContainer = document.getElementById('cal-month-title');
    if (!gridContainer || !titleContainer)
        return;
    gridContainer.innerHTML = '';
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    titleContainer.textContent = `${monthNames[displayedMonth]} ${displayedYear}`;
    const { data: blockedDays } = await db.from('blocked_dates').select('*');
    const { data: bookingsData } = await db.from('bookings').select('booking_date, status').eq('status', 'confirmed');
    const firstDayIndex = new Date(displayedYear, displayedMonth, 1).getDay();
    const offset = (firstDayIndex === 0) ? 6 : firstDayIndex - 1;
    const totalDays = new Date(displayedYear, displayedMonth + 1, 0).getDate();
    const prevMonthDays = new Date(displayedYear, displayedMonth, 0).getDate();
    for (let i = offset - 1; i >= 0; i--) {
        const span = document.createElement('span');
        span.className = 'muted';
        span.textContent = String(prevMonthDays - i);
        gridContainer.appendChild(span);
    }
    for (let day = 1; day <= totalDays; day++) {
        const span = document.createElement('span');
        const formattedMonth = String(displayedMonth + 1).padStart(2, '0');
        const formattedDay = String(day).padStart(2, '0');
        const dateStr = `${displayedYear}-${formattedMonth}-${formattedDay}`;
        span.textContent = String(day);
        span.setAttribute('data-date', dateStr);
        const records = blockedDays?.filter(b => b.block_date === dateStr);
        const openSlots = records?.filter(r => r.start_time).map(r => r.start_time.slice(0, 5)) || [];
        const isFullyBlocked = records?.some(r => !r.start_time);
        const hasBookings = bookingsData?.some(b => b.booking_date === dateStr);
        if (isFullyBlocked) {
            span.classList.add('day-blocked');
        }
        else if (hasBookings) {
            span.classList.add('day-booked');
        }
        else if (openSlots.length > 0) {
            span.classList.add('day-available');
        }
        span.addEventListener('click', () => {
            if (startInput)
                startInput.value = dateStr;
            document.querySelectorAll('.cal-grid span').forEach(s => s.classList.remove('selected-start'));
            span.classList.add('selected-start');
            loadAdminData();
        });
        gridContainer.appendChild(span);
    }
}
// Загрузка списков слотов и броней в админке
async function loadAdminData() {
    const selectedDate = startInput?.value || new Date().toISOString().split('T')[0];
    const { data: adminSlots } = await db
        .from('blocked_dates')
        .select('*')
        .eq('block_date', selectedDate)
        .not('start_time', 'is', null);
    const customSlotsBody = document.getElementById('admin-custom-slots-body');
    if (customSlotsBody) {
        customSlotsBody.innerHTML = '';
        if (adminSlots && adminSlots.length > 0) {
            const timeMap = {};
            adminSlots.forEach((slot) => {
                const time = slot.start_time.slice(0, 5);
                if (!timeMap[time])
                    timeMap[time] = [];
                timeMap[time].push(slot);
            });
            Object.keys(timeMap).sort().forEach((time) => {
                const slots = timeMap[time];
                const rooms = slots.map(s => s.room);
                const isCombo = rooms.includes('speech') && rooms.includes('beauty');
                const reason = slots[0]?.reason || '';
                let badgeName = reason;
                if (rooms.includes('massage') || reason.includes('Массаж'))
                    badgeName = 'Массаж';
                else if (rooms.includes('cosmetology') || reason.includes('Косметология'))
                    badgeName = 'Косметология';
                else if (rooms.includes('psychology') || reason.includes('Психология'))
                    badgeName = 'Психология';
                else if ((rooms.includes('speech') || reason.includes('Специалист по развитию речи и дефектолог') || reason.includes('Коррекция')) && !isCombo)
                    badgeName = 'Коррекция речи';
                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td style="padding:8px; font-weight:600; color:#065f46;">
            🕒 ${time} 
            <span style="background:${isCombo ? '#e0e7ff' : '#f3f4f6'}; color:${isCombo ? '#3730a3' : '#374151'}; padding:2px 6px; border-radius:4px; font-size:11px; margin-left:6px; font-weight:700;">
              ${isCombo ? '✨ КОМБО' : badgeName}
            </span>
          </td>
          <td style="padding:8px; text-align:right;">
            <button class="btn-delete-slot" data-time="${time}" style="background:#e06c75; color:#fff; border:none; padding:4px 8px; border-radius:6px; cursor:pointer;">Удалить</button>
          </td>
        `;
                customSlotsBody.appendChild(tr);
            });
            document.querySelectorAll('.btn-delete-slot').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const timeToDelete = btn.dataset.time + ':00';
                    await db.from('blocked_dates')
                        .delete()
                        .eq('block_date', selectedDate)
                        .eq('start_time', timeToDelete);
                    loadAdminData();
                    renderDynamicCalendar();
                });
            });
        }
        else {
            customSlotsBody.innerHTML = `<tr><td colspan="2" style="padding:8px; color:#718096;">Слоты времени еще не добавлены.</td></tr>`;
        }
    }
    // Загрузка клиентских броней
    const { data: bookings } = await db
        .from('bookings')
        .select('*')
        .eq('status', 'confirmed')
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true });
    const tbody = document.getElementById('bookings-table-body');
    if (!tbody)
        return;
    tbody.innerHTML = '';
    bookings?.forEach((b) => {
        let typeDisplay = b.booking_type;
        if (b.booking_type === 'combo')
            typeDisplay = '<span style="background:#e0e7ff; color:#3730a3; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">КОМБО</span>';
        else if (b.booking_type === 'speech')
            typeDisplay = 'Коррекция речи';
        else if (b.booking_type === 'massage')
            typeDisplay = 'Массаж';
        else if (b.booking_type === 'cosmetology')
            typeDisplay = 'Косметология';
        else if (b.booking_type === 'psychology')
            typeDisplay = 'Психология';
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td style="padding:10px;"><strong>${b.booking_date}</strong> в ${b.start_time.slice(0, 5)}</td>
      <td style="padding:10px;">${typeDisplay}</td>
      <td style="padding:10px;">${b.client_name}</td>
      <td style="padding:10px;">${b.client_phone}</td>
      <td style="padding:10px;">
        <button class="btn-cancel" data-group="${b.booking_group_id}" style="background:#e06c75; color:#fff; border:none; padding:6px 12px; border-radius:8px; cursor:pointer;">Отменить</button>
      </td>
    `;
        tbody.appendChild(tr);
    });
    document.querySelectorAll('.btn-cancel').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const groupId = btn.dataset.group;
            if (!groupId || !confirm('Отменить запись и освободить слот?'))
                return;
            const target = bookings?.find((x) => x.booking_group_id === groupId);
            await db.from('bookings').update({ status: 'cancelled' }).eq('booking_group_id', groupId);
            if (target) {
                await db.functions.invoke('notify-booking', {
                    body: {
                        action: 'cancelled',
                        type: target.booking_type,
                        date: target.booking_date,
                        time: target.start_time.slice(0, 5),
                        name: target.client_name,
                        phone: target.client_phone,
                        email: target.client_email,
                    },
                });
            }
            loadAdminData();
            renderDynamicCalendar();
        });
    });
}
