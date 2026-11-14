'use strict';
// Translate only known internal engine phrases in visitor-facing text.
// Structured API fields and cryptocurrency symbols such as SOLUSDT are untouched.
(() => {
  const patterns = [
    [/\bSOL\s+stale\s+decision\b/gi, 'AI stale decision'],
    [/\bSOL\s+position\s+management\b/gi, 'AI position management'],
    [/\bSOL\s+monitoring\b/gi, 'AI monitoring'],
    [/\bSOL\s+recommendation\b/gi, 'AI recommendation'],
    [/\bSOL\s+API\s+error\b/gi, 'AI API error'],
    [/\bSOL\s+unavailable\b/gi, 'AI unavailable'],
    [/\bSOL\s+failed\b/gi, 'AI review failed'],
    [/\bSOL\s+review\b/gi, 'AI review'],
    [/\bSOL\s+decision\b/gi, 'AI decision'],
    [/\bSOL\s+engine\b/gi, 'AI engine'],
    [/\bSOL\s+activity\b/gi, 'AI activity'],
    [/\bSOL\s+calendar\b/gi, 'AI calendar'],
    [/\bSOL\s+consumption\b/gi, 'AI consumption'],
    [/\bSOL\s+event\s+receipt\b/gi, 'AI event receipt'],
    [/\bPrevious\s+SOL\s+Decisions\b/gi, 'Previous AI Decisions'],
    [/\bLast\s+SOL\s+review\b/gi, 'Last AI review']
  ];
  window.AITerminology = Object.freeze({ present(value) {
    if (typeof value !== 'string') return value;
    return patterns.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
  }});
})();
