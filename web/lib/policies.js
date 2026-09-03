// The one place app code imports the render policy.
//
// Next resolves a bare JSON import (Banner.js does the same with banner-layout.json, and that ships),
// but plain `node --test` does not - it requires `with { type: 'json' }`. Keeping the import HERE and
// out of web/lib/primewindow.js means the derivation stays testable under the bare Node runner while
// app code still gets a default without repeating the path.

import policies from '../../data/render_policies.json';

export default policies;
export { policies };
