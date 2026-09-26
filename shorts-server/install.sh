#!/usr/bin/env bash
# Автоматическая нарезка шортсов из видео на сервере (Ubuntu 22.04/24.04).
# Claude Code запускается по cron, пока ваш компьютер выключен.
#
# Запуск: вставить целиком в поле «Cloud-init / скрипт при создании» в Timeweb,
# либо на сервере под root:  bash install.sh
#
# Для проверки без установки:  bash install.sh --files-only /путь/к/папке
set -euo pipefail

# ==== НАСТРОЙКИ (можно оставить пустыми и заполнить позже в /home/shorts/shorts/.env) ====
CLAUDE_CODE_OAUTH_TOKEN="${CLAUDE_CODE_OAUTH_TOKEN:-}"   # из `claude setup-token` (подписка Pro/Max)
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"               # или ключ API с console.anthropic.com
TG_BOT_TOKEN="${TG_BOT_TOKEN:-}"                         # необязательно: бот от @BotFather
TG_CHAT_ID="${TG_CHAT_ID:-}"                             # необязательно: ваш chat id
SHORTS_PER_VIDEO="${SHORTS_PER_VIDEO:-5}"
WHISPER_MODEL="${WHISPER_MODEL:-small}"                  # tiny/base/small/medium
# ========================================================================================

write_files() {
  local APP="$1"
  mkdir -p "$APP"/{inbox,outbox,done,work,logs}

  cat > "$APP/run.sh" <<'EOF'
#!/usr/bin/env bash
# Вызывается cron'ом. Скачивает ссылки из inbox/links.txt и отдаёт новые видео Claude.
set -uo pipefail
cd "$(dirname "$0")"
export PATH="$PWD/venv/bin:$HOME/.local/bin:$HOME/.deno/bin:/usr/local/bin:/usr/bin:/bin"
set -a; [ -f .env ] && . ./.env; set +a
exec 9>"$PWD/work/.lock"; flock -n 9 || exit 0

if [ -s inbox/links.txt ]; then
  batch="work/links.$(date +%s).txt"
  mv inbox/links.txt "$batch"
  yt-dlp -f "bv*[height<=1080]+ba/b[height<=1080]/b" --merge-output-format mp4 \
    -o "inbox/%(title).60s [%(id)s].%(ext)s" -a "$batch" || echo "yt-dlp: часть ссылок не скачалась"
fi

shopt -s nullglob nocaseglob
videos=(inbox/*.mp4 inbox/*.mov inbox/*.mkv inbox/*.webm inbox/*.m4v)
[ ${#videos[@]} -eq 0 ] && exit 0

if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "$(date) нет CLAUDE_CODE_OAUTH_TOKEN / ANTHROPIC_API_KEY в .env"; exit 1
fi

echo "=== $(date) найдено видео: ${#videos[@]}"
claude -p "$(cat TASK.md)" \
  --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
  --max-turns 150 >> "logs/$(date +%F).log" 2>&1
echo "=== $(date) готово (код $?)"
EOF

  cat > "$APP/TASK.md" <<'EOF'
Ты работаешь на сервере без человека. Задача — нарезать вертикальные шортсы из видео.
Рабочая папка — текущая. Не изменяй скрипты (*.sh, *.py) и этот файл. Ничего не спрашивай — решай сам.

Число шортсов на видео: переменная окружения SHORTS_PER_VIDEO (по умолчанию 5).

Для КАЖДОГО видеофайла в `inbox/` (кроме links.txt), по одному:

1. Имя без расширения → NAME. Сделай короткий латинский slug → SLUG (только a-z0-9-).
2. Если нет `work/SLUG.json`: `python3 transcribe.py "inbox/<файл>" work/SLUG.json`
   (создаст также `work/SLUG.txt` — расшифровку с таймкодами в секундах). Это может занять долго — жди.
3. Прочитай `work/SLUG.txt`. Выбери SHORTS_PER_VIDEO лучших фрагментов:
   - длина 20–59 секунд, начало и конец на границах фраз;
   - первые 3 секунды — цепляющий хук (вопрос, сильное утверждение, эмоция);
   - фрагмент понятен без остального видео, есть законченная мысль/панчлайн;
   - фрагменты не пересекаются.
4. Для каждого фрагмента i (01, 02, …):
   - `python3 clip_srt.py work/SLUG.json START END > work/SLUG-i.srt`
   - `./cut.sh "inbox/<файл>" START END "outbox/SLUG/i-<короткий-slug>.mp4" work/SLUG-i.srt`
   Если cut.sh упал — прочитай ошибку, попробуй ещё раз; при повторной ошибке пропусти фрагмент.
5. Создай `outbox/SLUG/README.md`: для каждого шортса — файл, таймкоды в исходнике,
   заголовок (до 60 символов), описание (1–2 предложения), 5 хэштегов.
   Язык — язык видео.
6. `./notify.sh outbox/SLUG`
7. Перемести исходник: `mv "inbox/<файл>" done/`

В конце выведи краткий отчёт: сколько видео обработано, сколько шортсов сделано, ошибки.
EOF

  cat > "$APP/transcribe.py" <<'EOF'
#!/usr/bin/env python3
"""transcribe.py VIDEO OUT.json -> расшифровка с таймкодами слов (+ OUT.txt для чтения)."""
import json, os, sys
from faster_whisper import WhisperModel

src, out = sys.argv[1], sys.argv[2]
model = WhisperModel(os.environ.get("WHISPER_MODEL", "small"), device="cpu", compute_type="int8")
segments, info = model.transcribe(src, word_timestamps=True, vad_filter=True)

data = {"language": info.language, "duration": info.duration, "segments": []}
lines = []
for s in segments:
    text = s.text.strip()
    data["segments"].append({
        "start": round(s.start, 2), "end": round(s.end, 2), "text": text,
        "words": [{"start": round(w.start, 2), "end": round(w.end, 2), "word": w.word.strip()}
                  for w in (s.words or [])],
    })
    lines.append(f"[{s.start:8.2f} - {s.end:8.2f}] {text}")

with open(out, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
with open(os.path.splitext(out)[0] + ".txt", "w", encoding="utf-8") as f:
    f.write(f"# language={info.language} duration={info.duration:.1f}s\n" + "\n".join(lines) + "\n")
print(f"ok: {len(lines)} segments, {info.duration:.0f}s, lang={info.language}")
EOF

  cat > "$APP/clip_srt.py" <<'EOF'
#!/usr/bin/env python3
"""clip_srt.py WORDS.json START END > clip.srt — короткие субтитры (по 1–3 слова) для фрагмента."""
import json, sys

src, start, end = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
words = [w for s in json.load(open(src, encoding="utf-8"))["segments"] for w in s["words"]
         if w["word"] and w["start"] >= start - 0.05 and w["end"] <= end + 0.05]

groups, cur = [], []
for w in words:
    if cur and (len(cur) >= 3 or w["start"] - cur[-1]["end"] > 0.6
                or len(" ".join(x["word"] for x in cur + [w])) > 18):
        groups.append(cur); cur = []
    cur.append(w)
if cur:
    groups.append(cur)

def ts(t):
    t = max(0.0, min(t, end) - start)
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"

for i, g in enumerate(groups, 1):
    print(f"{i}\n{ts(g[0]['start'])} --> {ts(g[-1]['end'])}\n{' '.join(x['word'] for x in g).upper()}\n")
EOF

  cat > "$APP/cut.sh" <<'EOF'
#!/usr/bin/env bash
# cut.sh INPUT START END OUTPUT.mp4 [SUBS.srt] — вертикальный 1080x1920 с размытым фоном и субтитрами.
set -euo pipefail
in="$1"; start="$2"; end="$3"; out="$4"; srt="${5:-}"
dur=$(awk -v a="$start" -v b="$end" 'BEGIN{printf "%.3f", b-a}')
mkdir -p "$(dirname "$out")"

vf="split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:2[bg];[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2"
tmp=""
if [ -n "$srt" ] && [ -s "$srt" ]; then
  tmp=$(mktemp /tmp/subsXXXXXX.srt); cp "$srt" "$tmp"
  vf="$vf,subtitles=$tmp:force_style='Fontname=DejaVu Sans,Fontsize=13,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=70'"
fi

ffmpeg -y -hide_banner -loglevel error -ss "$start" -t "$dur" -i "$in" \
  -filter_complex "[0:v]$vf,fps=30[v]" -map "[v]" -map "0:a?" \
  -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "$out"
[ -n "$tmp" ] && rm -f "$tmp"
echo "ok: $out"
EOF

  cat > "$APP/notify.sh" <<'EOF'
#!/usr/bin/env bash
# notify.sh outbox/SLUG — отправить готовые шортсы в Telegram (если настроен).
set -uo pipefail
dir="$1"
[ -z "${TG_BOT_TOKEN:-}" ] || [ -z "${TG_CHAT_ID:-}" ] && { echo "Telegram не настроен, пропуск"; exit 0; }
api="https://api.telegram.org/bot$TG_BOT_TOKEN"
curl -s "$api/sendMessage" -d chat_id="$TG_CHAT_ID" --data-urlencode text="Готовы шортсы: $(basename "$dir")" >/dev/null
[ -f "$dir/README.md" ] && curl -s "$api/sendDocument" -F chat_id="$TG_CHAT_ID" -F document=@"$dir/README.md" >/dev/null
for f in "$dir"/*.mp4; do
  [ -e "$f" ] || continue
  if [ "$(stat -c %s "$f")" -lt 49000000 ]; then
    curl -s "$api/sendVideo" -F chat_id="$TG_CHAT_ID" -F supports_streaming=true \
      -F caption="$(basename "$f")" -F video=@"$f" >/dev/null && echo "sent $f"
  else
    echo "skip (>49MB): $f"
  fi
done
EOF

  chmod +x "$APP"/*.sh "$APP"/*.py
}

if [ "${1:-}" = "--files-only" ]; then
  write_files "${2:?укажите папку}"; echo "files written to $2"; exit 0
fi

[ "$(id -u)" -eq 0 ] || { echo "Запустите под root"; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ffmpeg python3-venv python3-pip git curl unzip cron fonts-dejavu-core ca-certificates

id shorts >/dev/null 2>&1 || useradd -m -s /bin/bash shorts
APP=/home/shorts/shorts
write_files "$APP"

if [ ! -f "$APP/.env" ]; then
  cat > "$APP/.env" <<EOF
CLAUDE_CODE_OAUTH_TOKEN=$CLAUDE_CODE_OAUTH_TOKEN
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
TG_BOT_TOKEN=$TG_BOT_TOKEN
TG_CHAT_ID=$TG_CHAT_ID
SHORTS_PER_VIDEO=$SHORTS_PER_VIDEO
WHISPER_MODEL=$WHISPER_MODEL
EOF
  chmod 600 "$APP/.env"
fi
chown -R shorts:shorts /home/shorts

su - shorts -c "python3 -m venv $APP/venv && $APP/venv/bin/pip install -q --upgrade pip faster-whisper 'yt-dlp[default]'"
su - shorts -c 'curl -fsSL https://claude.ai/install.sh | bash'
su - shorts -c 'curl -fsSL https://deno.land/install.sh | sh -s -- -y' || echo "deno не установился (нужен только для YouTube)"

# Скачать модель whisper заранее, чтобы первый запуск не ждал
su - shorts -c "$APP/venv/bin/python -c \"from faster_whisper import WhisperModel; WhisperModel('$WHISPER_MODEL', device='cpu', compute_type='int8')\"" || true

systemctl enable --now cron
( crontab -u shorts -l 2>/dev/null | grep -v "$APP/run.sh" || true
  echo "*/15 * * * * $APP/run.sh >> $APP/logs/cron.log 2>&1" ) | crontab -u shorts -

echo
echo "Готово. Папки: $APP/inbox (видео или links.txt со ссылками) -> $APP/outbox (шортсы)."
echo "Проверка каждые 15 минут. Токен Claude: $APP/.env"
