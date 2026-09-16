# Shared LuCI compatibility correction

Removed the global forced vertical form layout, 680px field cap and forced full-width inputs. Default grid applies only to label/field pairs. Hidden fields, hidden attributes and inactive section tabs take precedence over visual styles. Unlabeled output panels use full width. Mobile table conversion is restricted to previously supported stock route groups, not arbitrary services.

Existing application-specific refinements remain. This addresses the demonstrated shared failure mechanisms; it does not certify every external application or remove all legacy CSS. New structural adaptations must be scoped and tested, as documented in luci-theme-oum/AGENTS.md.

Regression fixture: `playwright-cli -s=<session> run-code --filename=tests/theme-compatibility.browser.js`. Uses temporary DOM nodes on an authenticated LuCI page without saving configuration. Checks 390px and 1440px: hidden field, hidden attribute, inactive tab, full-width embedded panel and native third-party table.

Live checks: System, Firewall and Podkop at desktop/mobile sizes; syntax.sh passes. Backup: outputs/theme-compatibility/. No commits or router settings changes.

## Release 0.0.1 baseline clarification

The notes above describe the earlier shared-layer experiment, not the accepted release baseline. The unshipped stock-layout redesign and UX script were removed from the release after clean-install testing. The restored baseline does not pass the inactive-tab fixture or desktop custom-panel width check; see release-0.0.1.md. Do not treat the earlier live-check note as release certification.
