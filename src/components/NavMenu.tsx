"use client";
import { useState } from "react";

/** Phone menu: a button that shows or hides the links. On wide screens CSS shows the links and hides the button. */
export function NavMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn secondary menubtn" aria-expanded={open} aria-controls="mainmenu" onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}</button>
      <nav id="mainmenu" className={open ? "navlinks menu open" : "navlinks menu"} aria-label="Main" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
        {children}
      </nav>
    </>
  );
}
