# Theme compatibility

Preserve LuCI and third-party application layout and behavior. Shared theme styles should provide colors, typography and controls, not replace every application's structure.

- Do not force display on every .cbi-value. Only label/field pairs receive a default form grid; unlabeled output/DummyValue panels must use full width.
- Preserve .hidden, [hidden], inactive tab state and inline dependency visibility.
- Do not globally convert application tables into mobile cards. Scope structural adaptations to reviewed routes/components.
- Do not globally force field widths or max-widths onto custom panels and dynamic lists.
- Help controls must not activate associated fields. Keep keyboard operation and native form dependencies.
- Retain existing scoped refinements unless the same behavior is verified in the shared layer.
- On shared CSS changes, run tests/theme-compatibility.browser.js with an authenticated playwright-cli session. Check mobile and desktop stock forms and one third-party app; do not save router settings as part of visual checks.
- Bump the changed resource's URL version in header.ut on deployment.
