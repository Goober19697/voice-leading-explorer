export function distinctCandidates(candidates) {
  const seen = new Set();
  return candidates.filter(candidate => {
    const key = candidate.key || candidate.targets.map(target => target.to).sort((a, b) => a - b).join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function compareCandidates(a, b) {
  return a.totalCost - b.totalCost || b.commonCount - a.commonCount || a.key.localeCompare(b.key);
}

export function candidatesForEmotion(candidates, emotion) {
  const matching = distinctCandidates(candidates.filter(candidate => candidate.category === emotion));
  return matching.length ? matching : distinctCandidates(candidates);
}

export function candidateAt(candidates, selectedCandidateIndex) {
  return candidates[selectedCandidateIndex] || candidates[0] || null;
}

export function nextCandidateIndex(selectedCandidateIndex, candidateCount) {
  if (candidateCount < 2) return 0;
  return Math.min(selectedCandidateIndex + 1, candidateCount - 1);
}

export function previousCandidateIndex(selectedCandidateIndex) {
  return Math.max(selectedCandidateIndex - 1, 0);
}
