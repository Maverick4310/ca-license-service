import levenshtein from 'fast-levenshtein';
import { normalizeName } from '../utils/normalize.js';

export function scoreMatches(request) {

    const normalizedSource =
        normalizeName(request.name);

    const scored = request.results.map(result => {

        const normalizedTarget =
            normalizeName(result.entityName);

        const distance =
            levenshtein.get(
                normalizedSource,
                normalizedTarget
            );

        const longest =
            Math.max(
                normalizedSource.length,
                normalizedTarget.length
            );

        const similarity =
            Math.round(
                (1 - distance / longest) * 100
            );

        return {
            ...result,
            confidenceScore: similarity
        };
    });

    scored.sort(
        (a, b) =>
            b.confidenceScore - a.confidenceScore
    );

    return scored;
}
