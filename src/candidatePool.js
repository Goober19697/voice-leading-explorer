export function distinctCandidates(candidates) {
  const seen = new Set();
  return candidates.filter(candidate => {
    const key = candidate.key || candidate.targets.map(target => target.to).sort((a, b) => a - b).join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function candidateNaming(generatedName, analyses, names) {
  const primaryAnalysis = analyses[0];
  const format = analysis =>
    names[analysis.rootPc] + analysis.suffix + (analysis.rootless ? " (rootless)" : "");

  // A generated conventional name is more useful than a raw interval list.
  // Keep the interval analysis visible as an alias instead of leading with it.
  if (!primaryAnalysis || primaryAnalysis.fallback) {
    const aliases = primaryAnalysis ? analyses.map(format) : [];
    return { name: generatedName, aliases };
  }

  const name = format(primaryAnalysis);
  const aliases = analyses.slice(1).map(format);
  if (generatedName !== name && !aliases.includes(generatedName)) aliases.push(generatedName);
  return { name, aliases };
}

export function compareCandidates(a, b, bassOrder = "ascending") {
  // Always explore a genuinely new harmonic root before same-root recolorings.
  const rootChangeOrder = Number(Boolean(b.rootChanged)) - Number(Boolean(a.rootChanged));
  if (rootChangeOrder) return rootChangeOrder;

  const aBass = a.bassMovement ?? 0;
  const bBass = b.bassMovement ?? 0;
  const aStationary = aBass === 0 ? 1 : 0;
  const bStationary = bBass === 0 ? 1 : 0;
  if (aStationary !== bStationary) return aStationary - bStationary;

  const preferredSign = bassOrder === "descending" ? -1 : 1;
  const aDirection = aBass === 0 || Math.sign(aBass) === preferredSign ? 0 : 1;
  const bDirection = bBass === 0 || Math.sign(bBass) === preferredSign ? 0 : 1;
  if (aDirection !== bDirection) return aDirection - bDirection;

  // Walk outward chromatically in the selected direction, then use total
  // voice-leading distance only to resolve candidates with equal bass travel.
  return Math.abs(aBass) - Math.abs(bBass) ||
    a.totalCost - b.totalCost ||
    b.commonCount - a.commonCount ||
    a.key.localeCompare(b.key);
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
