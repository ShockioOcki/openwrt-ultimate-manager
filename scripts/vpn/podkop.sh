#!/bin/sh
# OUM VPN — Podkop Watchdog

install_watchdog() {
    inf "Установка Podkop Watchdog..."
    cat > /usr/bin/podkop-watchdog.sh << 'EOF'
#!/bin/sh

TARGET="mail.ru"
PING_COUNT=3
PING_TIMEOUT=3
RESTART_DELAY=30
MAX_ATTEMPTS=3

attempt=1
echo "=== Podkop Watchdog ==="
echo "Цель проверки: $TARGET"
echo "Максимум попыток: $MAX_ATTEMPTS"
echo ""

while [ $attempt -le $MAX_ATTEMPTS ]; do
    echo "Попытка $attempt из $MAX_ATTEMPTS: проверяем доступность $TARGET..."
    
    if ping -c $PING_COUNT -W $PING_TIMEOUT $TARGET > /dev/null 2>&1; then
        echo "  [OK] $TARGET доступен. Интернет работает."
        echo ""
        echo "=== Результат: Интернет в порядке, podkop не требует перезапуска ==="
        exit 0
    fi
    
    echo "  [FAIL] $TARGET недоступен. Перезапуск podkop..."
    /etc/init.d/podkop restart
    echo "  [OK] podkop перезапущен."
    
    if [ $attempt -lt $MAX_ATTEMPTS ]; then
        echo "  Ожидание $RESTART_DELAY сек перед следующей проверкой..."
        sleep $RESTART_DELAY
    fi
    
    attempt=$((attempt + 1))
done

echo ""
echo "=== Результат: Интернет НЕ восстановлен после $MAX_ATTEMPTS попыток ==="
exit 1
EOF
    chmod +x /usr/bin/podkop-watchdog.sh
    ok "Watchdog установлен: /usr/bin/podkop-watchdog.sh"
    
    inf "Добавляем в rc.local..."
    if ! grep -q "podkop-watchdog" /etc/rc.local 2>/dev/null; then
        sed -i '/exit 0/d' /etc/rc.local 2>/dev/null || true
        echo "(sleep 60 && /usr/bin/podkop-watchdog.sh) &" >> /etc/rc.local
        echo "exit 0" >> /etc/rc.local
        ok "Добавлено в rc.local"
    else
        wrn "Watchdog уже есть в rc.local"
    fi
}

run_watchdog() {
    if [ -f /usr/bin/podkop-watchdog.sh ]; then
        inf "Запуск Podkop Watchdog..."
        /usr/bin/podkop-watchdog.sh
    else
        err "Watchdog не установлен. Сначала установите его."
    fi
}

podkop_status() {
    hdr "=== Статус Podkop ==="
    if /etc/init.d/podkop status 2>/dev/null | grep -q running; then
        ok "Podkop: работает"
    else
        err "Podkop: не запущен"
    fi
    if [ -f /usr/bin/podkop-watchdog.sh ]; then
        ok "Watchdog: установлен"
    else
        err "Watchdog: не установлен"
    fi
}
