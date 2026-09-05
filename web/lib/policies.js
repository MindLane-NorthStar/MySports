// The one place app code imports the render policy.
//
// Next resolves a bare JSON import, but plain `node --test` does not - it requires
// `with { type: 'json' }`. Keeping the import HERE and out of web/lib/primewindow.js means the
// derivation stays testable under the bare Node runner while app code still gets a default without
// repeating the path. (Banner.js used to be the other bare-JSON importer; banner v2 bakes its
// coordinates into the components, so render_policies.json is now the only one.)

import policies from '../../data/render_policies.json';

export default policies;
export { policies };
