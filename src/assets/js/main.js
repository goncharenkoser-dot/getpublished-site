const burger = document.querySelector(".site-header__burger");
const nav = document.querySelector(".site-header__nav");

if (burger && nav) {
  burger.addEventListener("click", () => {
    const isOpen = burger.getAttribute("aria-expanded") === "true";
    burger.setAttribute("aria-expanded", String(!isOpen));
    nav.classList.toggle("site-header__nav--open", !isOpen);
  });
}

const modal = document.getElementById("lead-modal");

if (modal) {
  document.querySelectorAll('[data-lead-open], a[href="#lead"]').forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      modal.showModal();
    });
  });

  // закрытие кликом по подложке
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });

  const form = modal.querySelector(".lead-modal__form");
  const submit = modal.querySelector("[data-lead-submit]");

  submit.addEventListener("click", () => {
    if (!form.reportValidity()) return;

    const name = form.elements.name.value.trim();

    // TODO: отправка в CRM/рассылку — пока форма только подтверждает приём
    const done = document.createElement("div");
    done.className = "lead-modal__done";

    const heading = document.createElement("h2");
    heading.textContent = "Готово";

    const text = document.createElement("p");
    text.textContent = `Спасибо, ${name}! Проверьте почту — письмо с pdf уже летит.`;

    const close = document.createElement("button");
    close.className = "btn";
    close.type = "submit";
    close.value = "done";
    close.textContent = "Закрыть";

    done.append(heading, text, close);
    form.replaceChildren(done);
  });
}

// Плашка-навигация страницы программ прилипает под шапкой: передаём её высоту в CSS.
const siteHeader = document.querySelector(".site-header");
const programNav = document.querySelector(".pnav");

if (siteHeader && programNav) {
  const setNavTop = () => {
    document.documentElement.style.setProperty("--pnav-top", `${siteHeader.offsetHeight}px`);
  };
  setNavTop();
  window.addEventListener("resize", setNavTop);
}

// Форма заявки на наставничество (страница программ): валидация и подтверждение.
// TODO: отправка в CRM/рассылку — адрес приёма заявок ждём от заказчика.
const mentoringForm = document.querySelector("[data-mentoring-form]");

if (mentoringForm) {
  const submit = mentoringForm.querySelector("[data-mentoring-submit]");

  submit.addEventListener("click", () => {
    if (!mentoringForm.reportValidity()) return;

    const name = mentoringForm.elements.name.value.trim();
    const mentor = mentoringForm.elements.mentor.value;

    const done = document.createElement("div");
    done.className = "mform__done";

    const heading = document.createElement("h3");
    heading.textContent = "Заявка принята";

    const text = document.createElement("p");
    text.textContent = mentor
      ? `Спасибо, ${name}! Консультант свяжется с вами и согласует время диагностики с наставником ${mentor}.`
      : `Спасибо, ${name}! Консультант свяжется с вами, подберёт наставника и согласует время диагностики.`;

    done.append(heading, text);
    mentoringForm.replaceChildren(done);
  });
}

// Первый экран «Вселенная»: при скролле поле орбит разлетается и гаснет,
// а бегущие строки достраивают вторую половину дорожки для бесшовной петли
const universe = document.querySelector("[data-universe]");

if (universe) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!reduced) {
    let ticking = false;
    const frame = () => {
      ticking = false;
      const h = universe.offsetHeight || 1;
      const out = Math.min(1, Math.max(0, -universe.getBoundingClientRect().top / (h * 0.72)));
      universe.style.setProperty("--out", out.toFixed(3));
      universe.classList.toggle("bp-is-out", out > 0.98);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(frame);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    frame();
  }

  universe.querySelectorAll("[data-loop]").forEach((track) => {
    Array.from(track.children).forEach((child) => {
      const clone = child.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    });
  });
}

// Ценовые блоки с dod2026_sales: галочка спеццены, модалки GetCourse
// и счётчик записавшихся на разбор
document.querySelectorAll("[data-spec]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const box = btn.closest("[data-price]");
    if (!box) return;
    const on = box.classList.toggle("bp-is-spec");
    btn.setAttribute("aria-pressed", String(on));
    btn.querySelector("span").textContent = on
      ? "спеццена дней открытых дверей"
      : "открыть спеццену дней открытых дверей";
  });
});

let openModal = null;

const showModal = (id) => {
  const modal = document.getElementById(id);
  if (!modal) return;
  // виджет грузится при первом открытии, loc — текущая страница
  const frame = modal.querySelector("iframe[data-src]");
  if (frame) {
    frame.src = frame.dataset.src + encodeURIComponent(location.href);
    delete frame.dataset.src;
  }
  modal.classList.remove("bp-is-closed");
  document.documentElement.style.overflow = "hidden";
  openModal = modal;
};

const hideModal = () => {
  if (!openModal) return;
  openModal.classList.add("bp-is-closed");
  document.documentElement.style.overflow = "";
  openModal = null;
};

document.addEventListener("click", (event) => {
  const opener = event.target.closest("[data-open]");
  if (opener) {
    event.preventDefault();
    showModal(opener.dataset.open === "talk" ? "m-talk" : "m-book");
    return;
  }
  if (event.target.closest("[data-close]")) {
    event.preventDefault();
    hideModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideModal();
});

// Как в источнике: число считается от даты и часа, чтобы не прыгать
// при каждой перезагрузке; за день не превышает 11
const today = document.querySelector("[data-today]");

if (today) {
  const rnd = (n) => {
    const x = Math.sin(n) * 10000;
    return x - Math.floor(x);
  };
  const now = new Date();
  const day = Math.floor((now - now.getTimezoneOffset() * 60000) / 86400000);
  const cap = Math.min(11, 6 + Math.floor(rnd(day) * 6));
  let n = 1;
  for (let h = 9; h <= Math.min(now.getHours(), 22); h++) {
    if (rnd(day * 24 + h) > 0.42) n++;
  }
  n = Math.min(n, cap);
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = "будущих авторов";
  let verb = "записалось";
  if (mod10 === 1 && mod100 !== 11) {
    word = "будущий автор";
    verb = "записался";
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    word = "будущих автора";
  }
  today.querySelector("span").textContent = `Сегодня ${verb} ${n} ${word}`;
  today.hidden = false;
}

// Видеоотзывы: плеер Vimeo встаёт на место постера только по нажатию
document.addEventListener("click", (event) => {
  const facade = event.target.closest(".video__facade");
  if (!facade) return;
  const { vimeo, hash } = facade.dataset;
  const player = document.createElement("div");
  player.className = "video__player";
  const frame = document.createElement("iframe");
  frame.src = `https://player.vimeo.com/video/${vimeo}?${hash ? `h=${hash}&` : ""}autoplay=1&dnt=1`;
  frame.allow = "autoplay; fullscreen; picture-in-picture";
  frame.allowFullscreen = true;
  frame.title = facade.getAttribute("aria-label");
  player.appendChild(frame);
  facade.replaceWith(player);
});
