const sidebar =
    document.getElementById("studentSidebar") ||
    document.querySelector(".admin-sidebar");

if (sidebar) {
    const usesCompactLayout = sidebar.classList.contains("sp-sidebar");
    const toggleButton = document.getElementById(
        usesCompactLayout ? "spMobileToggle" : "sidebarToggle"
    );
    const backdrop = usesCompactLayout
        ? document.getElementById("spBackdrop")
        : document.createElement("div");

    sidebar.classList.add("student-sidebar");

    if (!usesCompactLayout) {
        backdrop.className = "student-sidebar-backdrop";
        backdrop.setAttribute("aria-hidden", "true");
        document.body.append(backdrop);
    }

    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = usesCompactLayout
        ? "sp-sidebar-back"
        : "student-sidebar-back";
    backButton.textContent = "← Back";
    backButton.setAttribute("aria-label", "Close navigation menu");

    const brand = sidebar.querySelector(".sidebar-brand, .sp-brand");
    if (brand) {
        brand.after(backButton);
    } else {
        sidebar.prepend(backButton);
    }

    const isOpen = () =>
        sidebar.classList.contains(usesCompactLayout ? "open" : "mobile-open");

    const setOpen = open => {
        sidebar.classList.toggle(
            usesCompactLayout ? "open" : "mobile-open",
            open
        );
        backdrop?.classList.toggle(
            usesCompactLayout ? "show" : "active",
            open
        );
        toggleButton?.setAttribute("aria-expanded", String(open));
    };

    backButton.addEventListener("click", () => setOpen(false));
    backdrop?.addEventListener("click", () => setOpen(false));
    toggleButton?.addEventListener("click", () => {
        window.setTimeout(() => setOpen(isOpen()), 0);
    });

    sidebar.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") setOpen(false);
    });

    window.addEventListener("resize", () => {
        const mobileBreakpoint = usesCompactLayout ? 820 : 900;
        if (window.innerWidth > mobileBreakpoint) setOpen(false);
    });

    setOpen(isOpen());
}
