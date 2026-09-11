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
