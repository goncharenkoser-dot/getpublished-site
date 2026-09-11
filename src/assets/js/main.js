const burger = document.querySelector(".site-header__burger");
const nav = document.querySelector(".site-header__nav");

if (burger && nav) {
  burger.addEventListener("click", () => {
    const isOpen = burger.getAttribute("aria-expanded") === "true";
    burger.setAttribute("aria-expanded", String(!isOpen));
    nav.classList.toggle("site-header__nav--open", !isOpen);
  });
}
