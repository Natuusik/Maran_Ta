"use strict";
// @ts-nocheck
const db = window.supabase.createClient('https://gqtqpjqnraozoumohzpk.supabase.co', 'sb_publishable_ReWzF60tqezy7KnsdPdQmA_6HK0gW2I');
class MarantaCalendar {
    selectedType = 'combo';
    selectedDate = '';
    selectedTime = '';
    currentYear = new Date().getFullYear();
    currentMonth = new Date().getMonth();
    constructor() {
        this.initListeners();
        this.initAutoLoad();
    }
    formatDateToISO(dateStr) {
        if (!dateStr)
            return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
            return dateStr;
        if (dateStr.includes('.')) {
            const parts = dateStr.split('.');
            if (parts.length === 3)
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
    }
    initListeners() {
        document.querySelectorAll('[data-open-booking]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const preset = btn.dataset.preset;
                if (preset)
                    this.selectedType = preset;
                this.openModal();
            });
        });
        document.getElementById('close-booking-modal')?.addEventListener('click', () => {
            this.closeModal();
        });
        const typeSelect = document.getElementById('modal-type');
        if (typeSelect) {
            this.selectedType = typeSelect.value;
        }
        typeSelect?.addEventListener('change', () => {
            this.selectedType = typeSelect.value;
            this.selectedTime = '';
            this.renderCustomCalendar();
            const slotsContainer = document.getElementById('slots-grid');
            if (slotsContainer) {
                slotsContainer.innerHTML = '<span style="font-size: 13px; color: #777; grid-column: span 3;">Сначала выберите дату в календаре выше</span>';
            }
        });
        document.getElementById('booking-submit-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitBooking();
        });
    }
    // Автоматический запуск отрисовки календаря при старте страницы
    initAutoLoad() {
        const calendarContainer = document.getElementById('custom-calendar');
        const typeSelect = document.getElementById('modal-type');
        if (typeSelect) {
            this.selectedType = typeSelect.value;
        }
        const today = new Date();
        this.currentYear = today.getFullYear();
        this.currentMonth = today.getMonth();
        if (calendarContainer) {
            this.renderCustomCalendar();
        }
    }
    openModal() {
        const modal = document.getElementById('maranta-booking-modal');
        const typeSelect = document.getElementById('modal-type');
        if (typeSelect) {
            typeSelect.value = this.selectedType;
        }
        const today = new Date();
        this.currentYear = today.getFullYear();
        this.currentMonth = today.getMonth();
        if (modal)
            modal.style.display = 'flex';
        this.renderCustomCalendar();
    }
    closeModal() {
        const modal = document.getElementById('maranta-booking-modal');
        if (modal)
            modal.style.display = 'none';
    }
    // Рендеринг интерактивного календаря с подсветкой дней
    async renderCustomCalendar() {
        const calendarContainer = document.getElementById('custom-calendar');
        if (!calendarContainer)
            return;
        calendarContainer.innerHTML = '<div style="text-align:center; padding: 20px; color:#64748b; font-size:13px;">Загрузка календаря...</div>';
        const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
        const startDateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-01`;
        const lastDayNum = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const endDateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${lastDayNum}`;
        const { data: blocks } = await db
            .from('blocked_dates')
            .select('*')
            .gte('block_date', startDateStr)
            .lte('block_date', endDateStr);
        const { data: bookings } = await db
            .from('bookings')
            .select('room, start_time, booking_date, booking_type, status')
            .gte('booking_date', startDateStr)
            .lte('booking_date', endDateStr)
            .eq('status', 'confirmed');
        const daysWithSlots = new Set();
        const blocksByDate = {};
        blocks?.forEach(b => {
            if (!blocksByDate[b.block_date])
                blocksByDate[b.block_date] = [];
            blocksByDate[b.block_date].push(b);
        });
        const bookingsByDate = {};
        bookings?.forEach(b => {
            if (!bookingsByDate[b.booking_date])
                bookingsByDate[b.booking_date] = [];
            bookingsByDate[b.booking_date].push(b);
        });
        for (let d = 1; d <= lastDayNum; d++) {
            const formattedD = String(d).padStart(2, '0');
            const formattedM = String(this.currentMonth + 1).padStart(2, '0');
            const dateStr = `${this.currentYear}-${formattedM}-${formattedD}`;
            const dayBlocks = blocksByDate[dateStr] || [];
            if (dayBlocks.length === 0)
                continue;
            const timeMap = {};
            dayBlocks.forEach(b => {
                if (b.start_time) {
                    const t = b.start_time.slice(0, 5);
                    if (!timeMap[t])
                        timeMap[t] = [];
                    timeMap[t].push(b.room);
                }
            });
            const dayBookings = bookingsByDate[dateStr] || [];
            const busySpeech = new Set(dayBookings.filter(b => b.room === 'speech').map(b => b.start_time.slice(0, 5)));
            const busyBeauty = new Set(dayBookings.filter(b => b.room === 'beauty' || ['massage', 'cosmetology', 'psychology'].includes(b.booking_type)).map(b => b.start_time.slice(0, 5)));
            let hasAtLeastOneFree = false;
            Object.keys(timeMap).forEach(time => {
                const rooms = timeMap[time];
                const isComboSlot = rooms.includes('speech') && rooms.includes('beauty');
                let slotAvailable = false;
                if (this.selectedType === 'speech') {
                    if (!busySpeech.has(time) && !busyBeauty.has(time))
                        slotAvailable = true;
                }
                else if (['massage', 'cosmetology', 'psychology'].includes(this.selectedType)) {
                    if (!busyBeauty.has(time) && !busySpeech.has(time))
                        slotAvailable = true;
                }
                else if (this.selectedType === 'combo') {
                    if (isComboSlot && !busySpeech.has(time) && !busyBeauty.has(time))
                        slotAvailable = true;
                }
                if (slotAvailable) {
                    hasAtLeastOneFree = true;
                }
            });
            if (hasAtLeastOneFree) {
                daysWithSlots.add(dateStr);
            }
        }
        let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-weight: 600; font-size: 14px;">
        <button type="button" id="prev-month" style="background:#f1f5f9; border:none; border-radius:6px; padding:6px 10px; cursor:pointer;">◀</button>
        <span>${monthNames[this.currentMonth]} ${this.currentYear}</span>
        <button type="button" id="next-month" style="background:#f1f5f9; border:none; border-radius:6px; padding:6px 10px; cursor:pointer;">▶</button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 6px;">
        <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Вс</div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px;">
    `;
        const firstDayIndex = (new Date(this.currentYear, this.currentMonth, 1).getDay() + 6) % 7;
        const todayStr = new Date().toISOString().split('T')[0];
        for (let i = 0; i < firstDayIndex; i++) {
            html += `<div></div>`;
        }
        for (let day = 1; day <= lastDayNum; day++) {
            const formattedDay = String(day).padStart(2, '0');
            const formattedMonth = String(this.currentMonth + 1).padStart(2, '0');
            const dateStr = `${this.currentYear}-${formattedMonth}-${formattedDay}`;
            const isPast = dateStr < todayStr;
            const isFree = daysWithSlots.has(dateStr);
            const isSelected = this.selectedDate === dateStr;
            let bgColor = "#f1f5f9";
            let textColor = "#94a3b8";
            let clickable = false;
            if (!isPast) {
                if (isFree) {
                    bgColor = "#d1fae5"; // Зеленый — свободно
                    textColor = "#065f46";
                    clickable = true;
                }
                else {
                    bgColor = "#fee2e2"; // Красный — занято / выходной
                    textColor = "#991b1b";
                }
            }
            if (isSelected) {
                bgColor = "#059669";
                textColor = "#ffffff";
            }
            html += `
        <div class="calendar-day ${clickable ? 'available-day' : ''}" data-date="${dateStr}" 
             style="background-color: ${bgColor}; color: ${textColor}; padding: 8px 0; border-radius: 8px; text-align: center; font-size: 13px; font-weight: 600; ${clickable ? 'cursor: pointer;' : 'cursor: default;'} transition: 0.2s;">
          ${day}
        </div>
      `;
        }
        html += `</div>`;
        calendarContainer.innerHTML = html;
        calendarContainer.querySelectorAll('.available-day').forEach(el => {
            el.addEventListener('click', (e) => {
                const chosenDate = e.currentTarget.getAttribute('data-date');
                if (chosenDate) {
                    this.selectedDate = chosenDate;
                    this.selectedTime = '';
                    const hiddenInput = document.getElementById('modal-date');
                    if (hiddenInput)
                        hiddenInput.value = chosenDate;
                    // НОВОЕ: Красиво выводим выбранную дату на экран для клиента
                    const chosenDateText = document.getElementById('chosen-date-text');
                    if (chosenDateText) {
                        // Превращаем 2026-11-20 в красивый формат (например, 20 ноября 2026)
                        const options = { day: 'numeric', month: 'long', year: 'numeric' };
                        const dateObj = new Date(chosenDate + 'T00:00:00');
                        chosenDateText.textContent = dateObj.toLocaleDateString('ru-RU', options);
                    }
                    this.renderCustomCalendar();
                    this.loadAvailableSlots(chosenDate);
                }
            });
        });
        document.getElementById('prev-month')?.addEventListener('click', () => {
            this.currentMonth--;
            if (this.currentMonth < 0) {
                this.currentMonth = 11;
                this.currentYear--;
            }
            this.renderCustomCalendar();
        });
        document.getElementById('next-month')?.addEventListener('click', () => {
            this.currentMonth++;
            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear++;
            }
            this.renderCustomCalendar();
        });
    }
    async loadAvailableSlots(date) {
        const slotsContainer = document.getElementById('slots-grid');
        if (!slotsContainer)
            return;
        slotsContainer.innerHTML = '<p style="color:#64748b; font-size:13px; grid-column: span 3;">Проверяем доступное время...</p>';
        const cleanDate = this.formatDateToISO(date);
        const { data: blocks, error } = await db
            .from('blocked_dates')
            .select('*')
            .eq('block_date', cleanDate);
        if (error) {
            slotsContainer.innerHTML = `<p style="color:#d9534f; font-size:13px; grid-column: span 3;">Ошибка БД: ${error.message}</p>`;
            return;
        }
        let beautySlots = [];
        let speechSlots = [];
        let comboSlots = [];
        const timeToRoomsMap = {};
        if (blocks && blocks.length > 0) {
            blocks.forEach((block) => {
                if (block.start_time) {
                    const timeStr = block.start_time.slice(0, 5);
                    if (!timeToRoomsMap[timeStr])
                        timeToRoomsMap[timeStr] = [];
                    timeToRoomsMap[timeStr].push(block);
                }
            });
        }
        Object.keys(timeToRoomsMap).forEach((time) => {
            const slotRecords = timeToRoomsMap[time];
            const rooms = slotRecords.map(s => s.room);
            const isCombo = rooms.includes('speech') && rooms.includes('beauty');
            if (isCombo) {
                comboSlots.push(time);
            }
            else {
                if (rooms.includes('speech'))
                    speechSlots.push(time);
                if (rooms.includes('beauty') || rooms.includes('massage') || rooms.includes('cosmetology') || rooms.includes('psychology')) {
                    beautySlots.push(time);
                }
            }
        });
        const { data: bookings } = await db
            .from('bookings')
            .select('room, start_time, booking_type')
            .eq('booking_date', cleanDate)
            .eq('status', 'confirmed');
        const busySpeech = new Set(bookings?.filter((b) => b.room === 'speech').map((b) => b.start_time.slice(0, 5)));
        const busyBeauty = new Set(bookings?.filter((b) => b.room === 'beauty' || ['massage', 'cosmetology', 'psychology'].includes(b.booking_type)).map((b) => b.start_time.slice(0, 5)));
        let availableSlotsForDay = [];
        if (this.selectedType === 'speech') {
            availableSlotsForDay = speechSlots;
        }
        else if (['massage', 'cosmetology', 'psychology'].includes(this.selectedType)) {
            availableSlotsForDay = beautySlots;
        }
        else if (this.selectedType === 'combo') {
            availableSlotsForDay = comboSlots;
        }
        availableSlotsForDay.sort();
        slotsContainer.innerHTML = '';
        if (availableSlotsForDay.length === 0) {
            slotsContainer.innerHTML = `
        <div style="width: 100%; box-sizing: border-box; text-align: center; padding: 16px; background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b; font-size: 13px; font-weight: 500; grid-column: span 3;">
          📅 На выбранную дату нет свободных слотов. Выберите другой день в календаре.
        </div>`;
            return;
        }
        availableSlotsForDay.forEach((slot) => {
            let isAvailable = true;
            if (this.selectedType === 'speech') {
                if (busySpeech.has(slot) || busyBeauty.has(slot))
                    isAvailable = false;
            }
            else if (['massage', 'cosmetology', 'psychology'].includes(this.selectedType)) {
                if (busyBeauty.has(slot) || busySpeech.has(slot))
                    isAvailable = false;
            }
            else if (this.selectedType === 'combo') {
                if (busySpeech.has(slot) || busyBeauty.has(slot))
                    isAvailable = false;
            }
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `slot-btn ${isAvailable ? 'free' : 'busy'}`;
            btn.textContent = slot;
            btn.disabled = !isAvailable;
            btn.style.cssText = `padding: 10px 14px; border-radius: 8px; border: 1px solid ${isAvailable ? '#5c8374' : '#cbd5e1'}; background: ${isAvailable ? '#eef4f1' : '#f1f5f9'}; color: ${isAvailable ? '#2c3333' : '#94a3b8'}; cursor: ${isAvailable ? 'pointer' : 'not-allowed'}; font-weight: 600;`;
            if (isAvailable) {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.slot-btn').forEach((b) => {
                        b.style.background = '#eef4f1';
                        b.style.color = '#2c3333';
                    });
                    btn.style.background = '#5c8374';
                    btn.style.color = '#ffffff';
                    this.selectedTime = slot;
                });
            }
            slotsContainer.appendChild(btn);
        });
    }
    async submitBooking() {
        if (!this.selectedTime || !this.selectedDate) {
            alert('Пожалуйста, выберите дату в календаре и свободное время.');
            return;
        }
        const nameInput = document.getElementById('client-name');
        const phoneInput = document.getElementById('client-phone');
        const emailInput = document.getElementById('client-email');
        const name = nameInput ? nameInput.value : '';
        const phone = phoneInput ? phoneInput.value : '';
        const email = emailInput ? emailInput.value : '';
        if (!name || !phone) {
            alert('Пожалуйста, заполните имя и телефон.');
            return;
        }
        const cleanDate = this.formatDateToISO(this.selectedDate);
        const groupId = crypto.randomUUID();
        const [h, m] = this.selectedTime.split(':').map(Number);
        const endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const rowsToInsert = [];
        if (this.selectedType === 'combo') {
            rowsToInsert.push({
                booking_group_id: groupId,
                booking_type: this.selectedType,
                room: 'speech',
                booking_date: cleanDate,
                start_time: `${this.selectedTime}:00`,
                end_time: `${endTime}:00`,
                client_name: name,
                client_phone: phone,
                client_email: email,
                status: 'confirmed'
            }, {
                booking_group_id: groupId,
                booking_type: this.selectedType,
                room: 'beauty',
                booking_date: cleanDate,
                start_time: `${this.selectedTime}:00`,
                end_time: `${endTime}:00`,
                client_name: name,
                client_phone: phone,
                client_email: email,
                status: 'confirmed'
            });
        }
        else if (this.selectedType === 'speech') {
            rowsToInsert.push({
                booking_group_id: groupId,
                booking_type: this.selectedType,
                room: 'speech',
                booking_date: cleanDate,
                start_time: `${this.selectedTime}:00`,
                end_time: `${endTime}:00`,
                client_name: name,
                client_phone: phone,
                client_email: email,
                status: 'confirmed'
            });
        }
        else {
            rowsToInsert.push({
                booking_group_id: groupId,
                booking_type: this.selectedType,
                room: 'beauty',
                booking_date: cleanDate,
                start_time: `${this.selectedTime}:00`,
                end_time: `${endTime}:00`,
                client_name: name,
                client_phone: phone,
                client_email: email,
                status: 'confirmed'
            });
        }
        const { error } = await db.from('bookings').insert(rowsToInsert);
        if (error) {
            alert('К сожалению, это время только что заняли. Выберите другой слот.');
            this.loadAvailableSlots(this.selectedDate);
            return;
        }
        await db.functions.invoke('notify-booking', {
            body: {
                groupId,
                type: this.selectedType,
                date: cleanDate,
                time: this.selectedTime,
                name,
                phone,
                email,
            },
        });
        alert(`Вы успешно записаны на ${cleanDate} в ${this.selectedTime}! Подтверждение отправлено.`);
        this.closeModal();
        location.reload();
    }
}
document.addEventListener('DOMContentLoaded', () => {
    new MarantaCalendar();
});
