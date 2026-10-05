'use strict';
// Display labels only: never change the feed or infer separate guard outcomes.
window.intelligenceWording = Object.freeze({
  heading: raw => raw === 'FAIL-OPEN' ? 'Allowed — intelligence data incomplete' : raw === 'UNKNOWN' || !raw ? 'Not confirmed' : raw,
  decision: raw => raw === 'FAIL-OPEN' ? 'Allowed' : raw === 'UNKNOWN' || !raw ? 'Not confirmed' : raw,
  block: raw => raw === 'UNKNOWN' || !raw ? 'Not confirmed' : raw,
  explanation: 'Trade was allowed because no confirmed intelligence rule blocked it. Some supporting intelligence data was incomplete or unavailable.'
});
