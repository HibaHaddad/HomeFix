"use client";

import { useEffect, type RefObject } from "react";
import type { HouseSceneState } from "./scene-state";

export const storyIds = ["top", "services", "plomberie", "electricite", "climatisation", "how", "trust"];
const DURATION = 6.5;
const HOLD = 0.35;
const TRANSITION = 1 - HOLD;

/** One playhead owns the camera poses, text transitions and chapter navigation. */
export function useHouseStory(
  root: RefObject<HTMLElement | null>,
  journey: RefObject<HTMLDivElement | null>,
  scene: RefObject<HouseSceneState>,
  reduced: boolean,
  onChapter: (chapter: number) => void,
) {
  useEffect(() => {
    const page = root.current;
    const track = journey.current;
    if (!page || !track) return;
    let cancelled = false;
    let dispose = () => {};

    async function initialize() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled || !page || !track) return;
      gsap.registerPlugin(ScrollTrigger);
      const panels = Array.from(track.querySelectorAll<HTMLElement>(".hf-chapter"));
      const bar = page.querySelector<HTMLElement>(".hf-reading-progress");
      const stage = track.querySelector<HTMLElement>(".hf-stage")!;
      let active = -1;
      let focusChapter: number | null = null;

      const activate = (index: number) => {
        if (index === active) return;
        active = index;
        onChapter(index);
        panels.forEach((panel, i) => {
          panel.inert = !reduced && i !== index;
          if (reduced) panel.removeAttribute("aria-hidden");
          else panel.setAttribute("aria-hidden", String(i !== index));
        });
        track.dataset.chapter = String(index);
        if (focusChapter === index) {
          requestAnimationFrame(() => { if (!cancelled) panels[index].focus({ preventScroll: true }); });
          focusChapter = null;
        }
      };

      let trigger: ReturnType<typeof ScrollTrigger.create>;
      const ctx = gsap.context(() => {
        if (reduced) {
          scene.current.progress = 0;
          panels.forEach(panel => { panel.inert = false; panel.removeAttribute("aria-hidden"); });
          trigger = ScrollTrigger.create({ trigger: track, start: "top top", end: "bottom bottom", onUpdate: self => {
            if (bar) bar.style.transform = `scaleX(${self.progress})`;
          } });
          activate(0);
          scene.current.invalidate?.();
          return;
        }
        gsap.set(panels, { autoAlpha: 0, xPercent: 105 });
        gsap.set(panels[0], { autoAlpha: 1, xPercent: 0 });
        const clock = { value: 0 };
        const timeline = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          onUpdate: () => {
            const time = timeline.time();
            // Change the accessible chapter at the shared visual midpoint.
            activate(Math.min(6, Math.max(0, Math.floor(time + 1 - HOLD - TRANSITION / 2))));
            if (bar) bar.style.transform = `scaleX(${time / DURATION})`;
            const pose = scene.current.progress.toFixed(4);
            if (track.dataset.pose !== pose) track.dataset.pose = pose;
            scene.current.invalidate?.();
          },
          scrollTrigger: {
            trigger: track, start: () => `top ${parseFloat(getComputedStyle(stage).top)}px`,
            end: "bottom bottom", scrub: 0.65, invalidateOnRefresh: true,
          },
        });
        // A full-duration clock keeps the final CTA on screen for a reading beat.
        timeline.to(clock, { value: 1, duration: DURATION, ease: "none" }, 0);
        for (let i = 0; i < panels.length - 1; i++) {
          const start = i + HOLD;
          timeline.to(scene.current, { progress: (i + 1) / 6, duration: TRANSITION }, start);
          // Adjacent slides remain spatially separate, including mid-transition.
          timeline.to(panels[i], { autoAlpha: 0, xPercent: -105, duration: TRANSITION }, start);
          timeline.fromTo(panels[i + 1], { autoAlpha: 0, xPercent: 105 }, { autoAlpha: 1, xPercent: 0, duration: TRANSITION, immediateRender: false }, start);
        }
        trigger = timeline.scrollTrigger!;
        activate(0);
      }, track);

      const navigate = (index: number, hash: string, smooth: boolean) => {
        const panel = panels[index];
        focusChapter = index;
        if (reduced) {
          panel.scrollIntoView({ behavior: "instant", block: "start" });
          panel.focus({ preventScroll: true });
        } else {
          const start = trigger.start;
          const end = trigger.end;
          const time = index === 0 ? 0 : index + 0.12;
          window.scrollTo({ top: start + (end - start) * time / DURATION, behavior: smooth ? "smooth" : "instant" });
          if (index === active) { panel.focus({ preventScroll: true }); focusChapter = null; }
        }
        if (hash !== window.location.hash) window.history.pushState(window.history.state, "", hash);
      };
      const click = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href^='#']");
        if (!anchor) return;
        const hash = anchor.getAttribute("href")!;
        const index = storyIds.indexOf(hash.slice(1));
        if (index < 0) return;
        event.preventDefault();
        navigate(index, hash, !reduced);
      };
      const hashChange = () => {
        const index = storyIds.indexOf(window.location.hash.slice(1));
        if (index >= 0) navigate(index, window.location.hash, false);
      };
      page.addEventListener("click", click);
      window.addEventListener("hashchange", hashChange);
      track.classList.add("hf-story-ready");
      const refresh = () => {
        if (cancelled) return;
        ScrollTrigger.refresh();
        if (window.location.hash) hashChange();
      };
      void document.fonts.ready.then(refresh);
      dispose = () => {
        page.removeEventListener("click", click);
        window.removeEventListener("hashchange", hashChange);
        ctx.revert();
        panels.forEach(panel => { panel.inert = false; panel.removeAttribute("aria-hidden"); });
        track.classList.remove("hf-story-ready");
      };
    }
    void initialize().catch(() => {
      dispose();
      if (!cancelled) track.classList.add("hf-static");
    });
    return () => { cancelled = true; dispose(); };
  }, [root, journey, scene, reduced, onChapter]);
}
