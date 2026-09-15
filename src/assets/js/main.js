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
    heading.textContent = "готово";

    const text = document.createElement("p");
    text.textContent = `Спасибо, ${name}! Проверьте почту — письмо с pdf уже летит.`;

    const close = document.createElement("button");
    close.className = "btn";
    close.type = "submit";
    close.value = "done";
    close.textContent = "закрыть";

    done.append(heading, text, close);
    form.replaceChildren(done);
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
