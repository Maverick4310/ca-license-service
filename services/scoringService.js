import levenshtein from 'fast-levenshtein';
import { normalizeName } from '../utils/normalize.js';

export function scoreMatches(request) {

    const source =
        normalizeName(request.name);

    const scored =
        request.results.map(result => {

            const target =
                normalizeName(result.entityName);

            const distance =
                levenshtein.get(source, target);

            const longest =
                Math.max(
                    source.length,
                    target.length
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
