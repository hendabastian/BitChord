/**
 * 2D Spatial Navigation Engine for TV Remote D-Pad Navigation
 * Optimized for Samsung Smart TVs and Web Browsers
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

let activeTrap: HTMLElement | null = null;
let currentFocusedElement: HTMLElement | null = null;

export function setFocusTrap(container: HTMLElement | null): void {
  activeTrap = container;
  if (container) {
    const candidates = getFocusables(container);
    // Prioritize autofocus element if available, else first candidate
    const target =
      candidates.find((el) => el.getAttribute('data-tv-autofocus') === 'true') ||
      candidates[0];
    if (target) {
      applyFocus(target);
    }
  }
}

export function getActiveTrap(): HTMLElement | null {
  if (activeTrap && (!document.body.contains(activeTrap) || !activeTrap.offsetParent)) {
    activeTrap = null;
  }
  return activeTrap;
}

export function getFocusables(root: HTMLElement = document.body): HTMLElement[] {
  const selector =
    'button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href], input:not([disabled]), [data-tv-focus="true"]';
  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
  return elements.filter((el) => {
    // Must be visible and interactable
    if (el.getAttribute('aria-hidden') === 'true' || el.tabIndex === -1) return false;
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      el.offsetParent !== null
    );
  });
}

function calculateScore(current: DOMRect, target: DOMRect, dir: Direction): number | null {
  const currentCenter = {
    x: current.left + current.width / 2,
    y: current.top + current.height / 2,
  };
  const targetCenter = {
    x: target.left + target.width / 2,
    y: target.top + target.height / 2,
  };

  let primaryDist = 0;
  let orthoDist = 0;
  let hasOverlap = false;

  switch (dir) {
    case 'left':
      // Target must be clearly to the left
      if (targetCenter.x >= currentCenter.x - 2) return null;
      primaryDist = current.left - target.right;
      orthoDist = Math.abs(currentCenter.y - targetCenter.y);
      // Check vertical overlap (elements on the same shelf/row)
      const overlapY = Math.max(0, Math.min(current.bottom, target.bottom) - Math.max(current.top, target.top));
      if (overlapY > 0) {
        hasOverlap = true;
      }
      break;

    case 'right':
      // Target must be clearly to the right
      if (targetCenter.x <= currentCenter.x + 2) return null;
      primaryDist = target.left - current.right;
      orthoDist = Math.abs(currentCenter.y - targetCenter.y);
      // Check vertical overlap (elements on the same shelf/row)
      const overlapYRight = Math.max(0, Math.min(current.bottom, target.bottom) - Math.max(current.top, target.top));
      if (overlapYRight > 0) {
        hasOverlap = true;
      }
      break;

    case 'up':
      // Target must be clearly above
      if (targetCenter.y >= currentCenter.y - 2) return null;
      primaryDist = current.top - target.bottom;
      orthoDist = Math.abs(currentCenter.x - targetCenter.x);
      // Check horizontal overlap (elements in the same column or aligned)
      const overlapXUp = Math.max(0, Math.min(current.right, target.right) - Math.max(current.left, target.left));
      if (overlapXUp > 0) {
        hasOverlap = true;
      }
      break;

    case 'down':
      // Target must be clearly below
      if (targetCenter.y <= currentCenter.y + 2) return null;
      primaryDist = target.top - current.bottom;
      orthoDist = Math.abs(currentCenter.x - targetCenter.x);
      // Check horizontal overlap (elements in the same column or aligned)
      const overlapXDown = Math.max(0, Math.min(current.right, target.right) - Math.max(current.left, target.left));
      if (overlapXDown > 0) {
        hasOverlap = true;
      }
      break;
  }

  // Discard candidates that are behind the current element
  const primaryAllowance = dir === 'left' || dir === 'right' ? current.width * 0.4 : current.height * 0.4;
  if (primaryDist < -primaryAllowance) return null;

  const normalizedPrimary = Math.max(0, primaryDist);

  // If elements share overlap on the orthogonal axis (e.g. same shelf for left/right,
  // or vertically aligned cards for up/down), grant a strong affinity bonus
  const orthoWeight = hasOverlap ? 0.6 : 2.5;
  return normalizedPrimary + orthoDist * orthoWeight;
}

export function applyFocus(target: HTMLElement): void {
  if (currentFocusedElement && currentFocusedElement !== target) {
    currentFocusedElement.removeAttribute('data-focused');
  }

  currentFocusedElement = target;
  target.setAttribute('data-focused', 'true');
  target.focus();

  // Ensure high-visibility visual state
  target.addEventListener(
    'blur',
    () => {
      target.removeAttribute('data-focused');
      if (currentFocusedElement === target) {
        currentFocusedElement = null;
      }
    },
    { once: true }
  );

  // If the target is on the topmost shelf, guarantee the container is smoothly scrolled to 0
  // so that the shelf header (title & subtitle) is never truncated or hidden under the top menu
  const isTopShelf = target.closest('[data-shelf-index="0"]');
  if (isTopShelf) {
    const scrollContainer = target.closest('.overflow-y-auto');
    if (scrollContainer && scrollContainer.scrollTop < 140) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Scroll into view without shaking the parent layout
  target.scrollIntoView({
    behavior: 'auto',
    block: 'nearest',
    inline: 'nearest',
  });
}

export function navigateAmong(
  active: HTMLElement,
  candidates: HTMLElement[],
  dir: Direction
): boolean {
  if (!candidates.length) return false;

  const currentRect = active.getBoundingClientRect();
  let bestCandidate: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    if (candidate === active) continue;
    const targetRect = candidate.getBoundingClientRect();
    const score = calculateScore(currentRect, targetRect, dir);
    if (score !== null && score < bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate) {
    applyFocus(bestCandidate);
    return true;
  }

  return false;
}

export function navigateSpatial(dir: Direction): boolean {
  // Validate activeTrap: if trap is disconnected or hidden, automatically clear it
  if (activeTrap && (!document.body.contains(activeTrap) || !activeTrap.offsetParent)) {
    activeTrap = null;
  }

  const active = document.activeElement as HTMLElement | null;

  // If focus is outside activeTrap, release the stale trap!
  if (activeTrap && active && active !== document.body && !activeTrap.contains(active)) {
    activeTrap = null;
  }

  const root = activeTrap || document.body;
  let candidates = getFocusables(root);

  if (!candidates.length) {
    if (activeTrap) {
      activeTrap = null;
      candidates = getFocusables(document.body);
    }
    if (!candidates.length) return false;
  }

  // If nothing is focused, or focus is on document.body, pick the best initial target
  if (!active || active === document.body || !root.contains(active)) {
    const activeTabEl = document.querySelector<HTMLElement>('[data-active-tab="true"]');
    const defaultTarget =
      activeTabEl ||
      candidates.find((el) => el.getAttribute('data-tv-autofocus') === 'true') ||
      candidates[0];
    if (defaultTarget) {
      applyFocus(defaultTarget);
      return true;
    }
    return false;
  }

  // Detect logical TV zones (header vs content vs modal)
  const isInsideModal = active.closest('[role="dialog"], .fixed.z-50') !== null;
  const currentZone = isInsideModal
    ? 'modal'
    : active.closest('[data-tv-zone]')?.getAttribute('data-tv-zone') || 'content';

  // --- RULE 1: Inside Header Zone ---
  if (currentZone === 'header') {
    if (dir === 'left' || dir === 'right') {
      // Stay STRICTLY inside header zone when moving horizontally!
      const headerCandidates = candidates.filter(
        (el) => el.closest('[data-tv-zone]')?.getAttribute('data-tv-zone') === 'header'
      );
      return navigateAmong(active, headerCandidates, dir);
    }

    if (dir === 'down') {
      // Move from Header Zone down to Content Zone!
      const contentZone = document.querySelector<HTMLElement>('[data-tv-zone="content"]');
      if (contentZone) {
        // Guarantee content scroll is reset to top so the topmost shelf is immediately visible
        const scrollContainer = contentZone.querySelector<HTMLElement>('.overflow-y-auto');
        if (scrollContainer && scrollContainer.scrollTop > 0) {
          scrollContainer.scrollTo({ top: 0, behavior: 'instant' });
        }

        const contentCandidates = getFocusables(contentZone);
        if (contentCandidates.length > 0) {
          // Find candidates on the topmost shelf / section
          const topShelf = contentZone.querySelector('[data-shelf-index="0"], section:first-of-type, .grid');
          const topCandidates = topShelf ? getFocusables(topShelf as HTMLElement) : [];
          const pool = topCandidates.length > 0 ? topCandidates : contentCandidates;

          // Pick candidate with best horizontal center alignment to the active header item
          const activeRect = active.getBoundingClientRect();
          const activeCenterX = activeRect.left + activeRect.width / 2;
          let best: HTMLElement | null = null;
          let bestDist = Infinity;

          for (const cand of pool) {
            const r = cand.getBoundingClientRect();
            // Discard off-screen horizontal elements
            if (r.right < 56 || r.left > window.innerWidth - 56) continue;
            const candCenterX = r.left + r.width / 2;
            const dist = Math.abs(candCenterX - activeCenterX);
            if (dist < bestDist) {
              bestDist = dist;
              best = cand;
            }
          }

          if (best) {
            applyFocus(best);
            return true;
          }
          if (pool[0]) {
            applyFocus(pool[0]);
            return true;
          }
        }
      }
    }

    if (dir === 'up') {
      // Header is top boundary
      return false;
    }
  }

  // --- RULE 2: Inside Content Zone ---
  if (currentZone === 'content') {
    const currentRect = active.getBoundingClientRect();

    if (dir === 'up') {
      // If inside a multi-row grid, check if there are candidates in the row directly above in the same grid
      const currentGrid = active.closest('.grid');
      if (currentGrid) {
        const gridAbove = getFocusables(currentGrid as HTMLElement).filter(
          (el) => el !== active && el.getBoundingClientRect().bottom < currentRect.top - 4
        );
        if (gridAbove.length > 0) {
          const moved = navigateAmong(active, gridAbove, 'up');
          if (moved) return true;
        }
      }

      // Check if there are any focusable elements in content above current element
      const contentAbove = candidates.filter((el) => {
        const zone = el.closest('[data-tv-zone]')?.getAttribute('data-tv-zone');
        return (
          zone === 'content' &&
          el.getBoundingClientRect().bottom < currentRect.top - 8
        );
      });

      if (contentAbove.length === 0) {
        // We are on the top-most row/shelf of content! MOVE DIRECTLY TO MENU!
        const headerZone = document.querySelector<HTMLElement>('[data-tv-zone="header"]');
        if (headerZone) {
          const scrollContainer = document.querySelector<HTMLElement>('[data-tv-zone="content"] .overflow-y-auto');
          if (scrollContainer) {
            scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
          }
          // Priority 1: Focus the active tab button (e.g. 'Home')!
          const activeTabBtn = headerZone.querySelector<HTMLElement>('[data-active-tab="true"]');
          if (activeTabBtn) {
            applyFocus(activeTabBtn);
            return true;
          }
          // Priority 2: Closest header tab
          const headerCandidates = getFocusables(headerZone);
          if (headerCandidates.length > 0) {
            return navigateAmong(active, headerCandidates, 'up');
          }
        }
      } else {
        // Move to the row/shelf directly above
        const currentShelf = active.closest('[data-shelf-index], section');
        const prevCandidates = contentAbove.filter((el) => {
          const shelf = el.closest('[data-shelf-index], section');
          return !currentShelf || shelf !== currentShelf;
        });
        const pool = prevCandidates.length > 0 ? prevCandidates : contentAbove;
        const moved = navigateAmong(active, pool, 'up');
        if (moved) return true;
      }
    }

    if (dir === 'down') {
      // If inside a multi-row grid, check if there are candidates in the row directly below in the same grid
      const currentGrid = active.closest('.grid');
      if (currentGrid) {
        const gridBelow = getFocusables(currentGrid as HTMLElement).filter(
          (el) => el !== active && el.getBoundingClientRect().top > currentRect.bottom - 4
        );
        if (gridBelow.length > 0) {
          const moved = navigateAmong(active, gridBelow, 'down');
          if (moved) return true;
        }
      }

      // Find elements on the next shelf/row below current element
      const currentShelf = active.closest('[data-shelf-index], section');
      const nextCandidates = candidates.filter((el) => {
        const zone = el.closest('[data-tv-zone]')?.getAttribute('data-tv-zone');
        const shelf = el.closest('[data-shelf-index], section');
        return zone === 'content' && shelf !== currentShelf && el.getBoundingClientRect().top > currentRect.bottom - 4;
      });

      if (nextCandidates.length > 0) {
        const visibleNext = nextCandidates.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.right > 56 && r.left < window.innerWidth - 56;
        });
        const pool = visibleNext.length > 0 ? visibleNext : nextCandidates;
        const moved = navigateAmong(active, pool, 'down');
        if (moved) return true;
      }
    }

    if (dir === 'left' || dir === 'right') {
      // When moving horizontally in content, keep priority within the same shelf/row
      const shelfEl = active.closest('[data-shelf-index], section, .grid');
      if (shelfEl) {
        const shelfCandidates = getFocusables(shelfEl as HTMLElement);
        if (shelfCandidates.length > 1) {
          const moved = navigateAmong(active, shelfCandidates, dir);
          if (moved) return true;
        }
      }
    }
  }

  // Fallback: general spatial navigation
  return navigateAmong(active, candidates, dir);
}

export function initSpatialNavigation(): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Do not interfere if user is typing inside an actual input element
    const active = document.activeElement;
    const isTextInput =
      active instanceof HTMLInputElement &&
      (active.type === 'text' || active.type === 'search' || active.type === 'password');

    if (isTextInput) return;

    const key = e.key;
    const code = e.keyCode;

    const isLeft = key === 'ArrowLeft' || key === 'Left' || code === 37;
    const isRight = key === 'ArrowRight' || key === 'Right' || code === 39;
    const isUp = key === 'ArrowUp' || key === 'Up' || code === 38;
    const isDown = key === 'ArrowDown' || key === 'Down' || code === 40;
    const isEnter = key === 'Enter' || code === 13;

    if (isLeft || isRight || isUp || isDown) {
      // CRITICAL FOR TV & BROWSER: Always prevent native scrolling when arrow keys are pressed!
      e.preventDefault();

      if (isLeft) navigateSpatial('left');
      else if (isRight) navigateSpatial('right');
      else if (isUp) navigateSpatial('up');
      else if (isDown) navigateSpatial('down');
    } else if (isEnter) {
      if (active && active !== document.body) {
        e.preventDefault();
        (active as HTMLElement).click();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown, { passive: false });
  return () => window.removeEventListener('keydown', handleKeyDown);
}
