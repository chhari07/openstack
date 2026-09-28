// Kept out of theme.ts ("use client") so the server layout can inline it.
export const THEME_KEY = "stack.theme";

// Runs in <head> before first paint (see layout.tsx) so dark mode never flashes white.
export const THEME_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;
